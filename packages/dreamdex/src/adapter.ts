import {
  ORDER_TYPE,
  SOMNIA_TESTNET_ADDRESSES,
  SomniaMarkets,
  orderBookEventsAbi,
  type BinaryMarket,
  type MarketOnchain,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { decodeEventLog, defineChain, type Address, type Hex, type TransactionReceipt } from "viem";
import { deterministicFixture } from "./fixtures";
import { buildPreparedIoc, executableDepth, premiumAtLimit, stableFingerprint } from "./math";
import {
  DREAMDEX_SHANNON_VENUE,
  SHANNON_CHAIN_ID,
  SHANNON_EXPLORER,
  type BookParameters,
  type AuthorizedMarketMetadata,
  type BoundedIocRequest,
  type ConfirmedIocExecution,
  type ConfirmedRedemption,
  type DreamDexAdapterConfig,
  type EventMarketSnapshot,
  type EventOrderBook,
  type ExecutionAuthorization,
  type FinalizedMarket,
  type FixtureDocument,
  type MarketDiscoveryFilter,
  type Outcome,
  type OutcomePosition,
  type PreparedIocOrder,
  type SupportedAsset,
} from "./types";

const STATUS_NAMES = ["Listed", "Trading", "Locked", "Settling", "Resolved", "Voided"] as const;
const DEFAULTS = {
  rpcUrl: "https://api.infra.testnet.somnia.network",
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
} as const;

function asAsset(value: string): SupportedAsset | null {
  const upper = value.toUpperCase();
  return upper === "BTC" || upper === "ETH" ? upper : null;
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function statusName(status: number): EventMarketSnapshot["statusName"] {
  return STATUS_NAMES[status] ?? "Unknown";
}

function validatedEndpoint(value: string, schemes: readonly string[], label: string): string {
  const url = new URL(value);
  if (!schemes.includes(url.protocol)) throw new Error(`${label} must use ${schemes.join(" or ")}`);
  if (url.username || url.password) throw new Error(`${label} must not contain credentials`);
  const allowedHosts: Record<string, readonly string[]> = {
    rpcUrl: ["api.infra.testnet.somnia.network", "dream-rpc.somnia.network"],
    wsRpcUrl: ["api.infra.testnet.somnia.network"],
    indexerUrl: ["dev.smk.somnia.host"],
  };
  if (!allowedHosts[label]?.includes(url.hostname.toLowerCase())) throw new Error(`${label} host is not in the Shannon allowlist`);
  if (url.port && url.port !== "443") throw new Error(`${label} must use the default TLS port`);
  return url.toString();
}

function averageFillPrice(fills: readonly { fillPrice: bigint; quantityFilled: bigint }[], outcome: Outcome, one: bigint): bigint | undefined {
  const quantity = fills.reduce((sum, fill) => sum + fill.quantityFilled, 0n);
  if (quantity === 0n) return undefined;
  const numerator = fills.reduce((sum, fill) => {
    const ownPrice = outcome === "YES" ? fill.fillPrice : one - fill.fillPrice;
    return sum + ownPrice * fill.quantityFilled;
  }, 0n);
  return numerator / quantity;
}

function decodePoolOrderEvidence(receipt: TransactionReceipt, pool: Address): {
  orderId?: bigint;
  fills: { takerOrderId: bigint; makerOrderId: bigint; quantityFilled: bigint; takerRemainingQuantity: bigint; makerRemainingQuantity: bigint; fillPrice: bigint }[];
  restedOrderIds: Set<bigint>;
} {
  let orderId: bigint | undefined;
  const fills: { takerOrderId: bigint; makerOrderId: bigint; quantityFilled: bigint; takerRemainingQuantity: bigint; makerRemainingQuantity: bigint; fillPrice: bigint }[] = [];
  const restedOrderIds = new Set<bigint>();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== pool.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: orderBookEventsAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "OrderPlaced") orderId = decoded.args.orderId;
      if (decoded.eventName === "OrderRested") restedOrderIds.add(decoded.args.orderId);
      if (decoded.eventName === "OrderFilled") fills.push(decoded.args);
    } catch { /* The pool can emit other events in the same transaction. */ }
  }
  return { ...(orderId !== undefined ? { orderId } : {}), fills, restedOrderIds };
}

/**
 * Shannon-only DreamDEX Event Contracts adapter.
 *
 * The adapter deliberately exposes raw bigint units at its trust boundary. UI
 * code may format them, but authorization and transaction construction never
 * depend on JavaScript floating point.
 */
export class DreamDexAdapter {
  readonly mode: DreamDexAdapterConfig["mode"];
  readonly venueId: Hex | undefined;
  readonly exchange?: SomniaMarkets;
  private readonly now: () => number;
  private readonly fixture: FixtureDocument;
  private readonly executionGuard: DreamDexAdapterConfig["executionGuard"];
  private readonly consumedReceipts = new Set<string>();
  private writeTail: Promise<void> = Promise.resolve();

  constructor(config: DreamDexAdapterConfig) {
    const chainId = config.chainId ?? SHANNON_CHAIN_ID;
    if (chainId !== SHANNON_CHAIN_ID) throw new Error(`OutcomeGuard supports Shannon ${SHANNON_CHAIN_ID} only; got ${chainId}`);
    this.mode = config.mode;
    this.now = config.now ?? Date.now;
    this.fixture = config.fixture ?? deterministicFixture;
    this.executionGuard = config.executionGuard;
    this.venueId = config.venueId ?? (config.mode === "fixture" ? this.fixture.venueId : undefined);
    if (config.mode === "live") {
      const rpcUrl = validatedEndpoint(config.rpcUrl ?? DEFAULTS.rpcUrl, ["https:"], "rpcUrl");
      const wsRpcUrl = validatedEndpoint(config.wsRpcUrl ?? DEFAULTS.wsRpcUrl, ["wss:"], "wsRpcUrl");
      const indexerUrl = validatedEndpoint(config.indexerUrl ?? DEFAULTS.indexerUrl, ["https:"], "indexerUrl");
      const chain = defineChain({
        ...somniaShannon,
        rpcUrls: { default: { http: [rpcUrl], webSocket: [wsRpcUrl] } },
      });
      this.exchange = new SomniaMarkets({
        indexerUrl,
        chain,
        wsRpcUrl,
        addresses: SOMNIA_TESTNET_ADDRESSES,
        ...(config.privateKey ? { privateKey: config.privateKey } : {}),
        ...(config.walletClient ? { walletClient: config.walletClient } : {}),
      });
    }
  }

  async close(): Promise<void> {
    await this.exchange?.close();
  }

  async discoverMarkets(filter: MarketDiscoveryFilter = {}): Promise<EventMarketSnapshot[]> {
    if (this.mode === "fixture") {
      return this.fixture.markets.filter((market) => this.matchesFilter(market, filter));
    }
    const exchange = this.requireExchange();
    const rows = await exchange.client.listLiveBinaryMarkets({
      ...(this.venueId ? { venueId: this.venueId } : {}),
      ...(filter.asset ? { asset: filter.asset } : {}),
      ...(filter.intervalSec ? { intervalSec: filter.intervalSec } : {}),
      limit: Math.min(filter.limit ?? 50, 200),
    });
    const venues = new Set(rows.map((row) => row.venueId?.toLowerCase()).filter((v): v is string => Boolean(v)));
    if (!this.venueId && venues.size !== 1) {
      throw new Error(`ambiguous DreamDEX venue: found ${venues.size}; configure venueId explicitly`);
    }
    const snapshots = await Promise.all(rows.map((row) => this.snapshotFromRow(row)));
    return snapshots.filter((market) => this.matchesFilter(market, filter));
  }

  async getMarket(marketId: Hex): Promise<EventMarketSnapshot> {
    if (this.mode === "fixture") {
      const market = this.fixture.markets.find((item) => sameHex(item.marketId, marketId));
      if (!market) throw new Error(`fixture market not found: ${marketId}`);
      return market;
    }
    const row = await this.requireExchange().client.getBinaryMarket(marketId);
    if (!row) throw new Error(`market not found in binary registry: ${marketId}`);
    return this.snapshotFromRow(row);
  }

  async getBook(market: EventMarketSnapshot, depth = 20): Promise<EventOrderBook> {
    if (this.mode === "fixture") {
      const book = this.fixture.books[market.marketId];
      if (!book) throw new Error(`fixture book missing: ${market.marketId}`);
      return book;
    }
    return this.getLiveBook(market.marketId, market.pool, market.collateralDecimals, depth);
  }

  private async getLiveBook(marketId: Hex, pool: Address, collateralDecimals: number, depth = 20): Promise<EventOrderBook> {
    const exchange = this.requireExchange();
    const [raw, blockNumber] = await Promise.all([
      exchange.client.getBinaryOrderBook(pool, { depth, decimals: collateralDecimals }),
      exchange.client.getViemClient().getBlockNumber(),
    ]);
    return {
      marketId,
      capturedAt: new Date(this.now()).toISOString(),
      blockNumber,
      yesBids: raw.yesBids.map(({ price, quantity }) => ({ priceRaw: price, quantityRaw: quantity })),
      yesAsks: raw.yesAsks.map(({ price, quantity }) => ({ priceRaw: price, quantityRaw: quantity })),
      noBids: raw.noBids.map(({ price, quantity }) => ({ priceRaw: price, quantityRaw: quantity })),
      noAsks: raw.noAsks.map(({ price, quantity }) => ({ priceRaw: price, quantityRaw: quantity })),
    };
  }

  /**
   * Rebuild a write-time market snapshot from the signed metadata and direct
   * chain state. This deliberately avoids a second indexer dependency after
   * authorization while still failing closed on every execution-critical field.
   */
  async reconcileAuthorizedMarket(order: PreparedIocOrder, metadata: AuthorizedMarketMetadata): Promise<EventMarketSnapshot> {
    if (this.mode !== "live") throw new Error("fixture mode cannot reconcile an authorized market");
    const onchain = await this.getAuthorizedOnchain(order);
    if (!sameHex(onchain.collateral, metadata.collateral)) throw new Error("authorized collateral differs from chain state");
    if (onchain.decimals !== metadata.collateralDecimals) throw new Error("authorized collateral decimals differ from chain state");
    if (Number(onchain.expiry) !== metadata.expiry) throw new Error("authorized market expiry differs from chain state");
    return {
      marketId: order.marketId,
      marketAddress: onchain.marketAddress,
      pool: onchain.pool,
      poolNonce: onchain.nonce,
      outcomeToken: onchain.outcomeToken,
      yesId: onchain.yesId,
      noId: onchain.noId,
      collateral: onchain.collateral,
      collateralDecimals: onchain.decimals,
      asset: metadata.asset,
      intervalSec: metadata.intervalSec,
      tradingStart: metadata.expiry - metadata.intervalSec,
      expiry: Number(onchain.expiry),
      venueId: order.venueId,
      status: onchain.status,
      statusName: statusName(onchain.status),
      question: metadata.question,
      ...(metadata.oracleQuestion ? { oracleQuestion: metadata.oracleQuestion } : {}),
      ...(metadata.oracleQuestionId ? { oracleQuestionId: metadata.oracleQuestionId } : {}),
      strikeRaw: metadata.strikeRaw,
      fetchedAt: new Date(this.now()).toISOString(),
      source: "shannon-chain+indexer",
    };
  }

  async getBookParameters(market: EventMarketSnapshot): Promise<BookParameters> {
    if (this.mode === "fixture") {
      const params = this.fixture.bookParameters[market.marketId];
      if (!params) throw new Error(`fixture book parameters missing: ${market.marketId}`);
      return params;
    }
    return this.requireExchange().client.getBinaryBookParams(market.pool);
  }

  async prepareBoundedIoc(request: BoundedIocRequest): Promise<PreparedIocOrder> {
    this.assertVenue(request.market.venueId);
    const current = this.mode === "live" ? await this.getMarket(request.market.marketId) : request.market;
    if (!sameHex(current.pool, request.market.pool) || current.poolNonce !== request.market.poolNonce) {
      throw new Error("market pool generation changed since discovery");
    }
    const [book, params] = await Promise.all([
      this.getBook(current, request.visibleDepthLevels ?? 20),
      this.getBookParameters(current),
    ]);
    return buildPreparedIoc({
      market: current,
      book,
      params,
      outcome: request.outcome,
      quantityRaw: request.quantityRaw,
      maximumOutcomePriceRaw: request.maximumOutcomePriceRaw,
      premiumBudgetRaw: request.premiumBudgetRaw,
      maximumBookMoveBps: request.maximumBookMoveBps,
      expirySeconds: request.expirySeconds,
      ...(request.visibleDepthLevels ? { depthLevels: request.visibleDepthLevels } : {}),
      nowMs: this.now(),
    });
  }

  async executeBoundedIoc(order: PreparedIocOrder): Promise<ConfirmedIocExecution> {
    return this.serializeWrite(async () => {
      if (!this.executionGuard) throw new Error("write blocked: no policy-and-signature execution guard is configured");
      const authorization = await this.executionGuard(order);
      this.validateExecutionAuthorization(order, authorization);
      const result = await this.executeBoundedIocNow(order);
      this.consumedReceipts.add(authorization.receiptDigest.toLowerCase());
      return result;
    });
  }

  private validateExecutionAuthorization(order: PreparedIocOrder, authorization: ExecutionAuthorization): void {
    if (!authorization.verifiedHumanSignature) throw new Error("write blocked: human signature was not verified");
    if (authorization.authorizedChainId !== SHANNON_CHAIN_ID) throw new Error("write blocked: authorization targets the wrong chain");
    if (!sameHex(authorization.orderFingerprint, order.authorizationFingerprint)) throw new Error("write blocked: authorization is for a different order fingerprint");
    if (authorization.policyStatuses.length === 0 || authorization.policyStatuses.some((status) => status === "FAIL")) throw new Error("write blocked: policy bundle is empty or contains a failure");
    if (authorization.expiresAtMs <= this.now()) throw new Error("write blocked: authorization expired");
    if (this.consumedReceipts.has(authorization.receiptDigest.toLowerCase())) throw new Error("write blocked: authorization receipt was already consumed");
  }

  private async executeBoundedIocNow(order: PreparedIocOrder): Promise<ConfirmedIocExecution> {
    if (this.mode !== "live") throw new Error("fixture mode is read-only and cannot execute transactions");
    if (order.chainId !== SHANNON_CHAIN_ID) throw new Error(`write blocked: authorization targets chain ${order.chainId}`);
    this.assertVenue(order.venueId);
    const { authorizationFingerprint, ...authorizedFields } = order;
    if (stableFingerprint(authorizedFields) !== authorizationFingerprint) throw new Error("authorization fingerprint is invalid or was tampered with");
    const exchange = this.requireExchange();
    if (!exchange.walletAddress) throw new Error("a wallet signer is required for execution");
    const chainId = await exchange.client.getViemClient().getChainId();
    if (chainId !== SHANNON_CHAIN_ID) throw new Error(`write blocked: connected chain ${chainId} is not Shannon ${SHANNON_CHAIN_ID}`);
    const current = await this.getAuthorizedOnchain(order);
    if (current.status !== 1) throw new Error("pre-sign policy failed: market is not Trading");
    const [book, params] = await Promise.all([
      this.getLiveBook(order.marketId, current.pool, current.decimals),
      exchange.client.getBinaryBookParams(current.pool),
    ]);
    if (order.quantityRaw % params.lotSize !== 0n || order.quantityRaw < params.minQuantity) {
      throw new Error("pre-sign policy failed: quantity no longer satisfies the book grid");
    }
    if (order.outcomePriceRaw % params.tickSize !== 0n || order.yesPriceRaw % params.tickSize !== 0n) throw new Error("pre-sign policy failed: outcome or transmitted YES price no longer satisfies the book grid");
    const depth = executableDepth(book, order.outcome, order.outcomePriceRaw);
    if (depth.bestAskRaw === undefined || order.quantityRaw > depth.quantityRaw) {
      throw new Error("pre-sign policy failed: visible executable depth changed");
    }
    const maxMovedAsk = (order.observedBestAskRaw * (10_000n + order.maximumBookMoveBps)) / 10_000n;
    if (depth.bestAskRaw > maxMovedAsk) throw new Error("pre-sign policy failed: book moved beyond authorization tolerance");
    const one = 10n ** BigInt(current.decimals);
    const maxPremium = premiumAtLimit(order.quantityRaw, order.outcomePriceRaw, one);
    if (maxPremium > order.maximumPremiumRaw) throw new Error("pre-sign policy failed: premium exceeds authorization");
    if (order.expireTimestampNs <= BigInt(Math.floor(this.now() / 1_000)) * 1_000_000_000n) {
      throw new Error("pre-sign policy failed: authorization expired");
    }
    const [gasBalance, collateralBalance, collateralAllowance, positionBefore] = await Promise.all([
      exchange.client.getViemClient().getBalance({ address: exchange.walletAddress }),
      exchange.client.getErc20Balance(current.collateral, exchange.walletAddress),
      exchange.client.getErc20Allowance(current.collateral, exchange.walletAddress, current.pool),
      this.readOnchainPosition(order.marketId, current.outcomeToken, current.yesId, current.noId, exchange.walletAddress),
    ]);
    if (gasBalance === 0n) throw new Error("pre-sign policy failed: native Shannon gas balance is zero");
    if (collateralBalance < maxPremium) throw new Error("pre-sign policy failed: wallet collateral is below maximum premium");
    if (collateralAllowance < maxPremium) throw new Error("pre-sign policy failed: bounded collateral allowance is below maximum premium; approve the exact pool separately");
    const result = await exchange.trader.placeOrder({
      pool: order.pool,
      side: order.side,
      price: order.yesPriceRaw,
      quantity: order.quantityRaw,
      outcomeToken: order.outcomeToken,
      yesId: order.yesId,
      noId: order.noId,
      orderType: ORDER_TYPE.MARKET,
      expireTimestampNs: order.expireTimestampNs,
      autoApprove: false,
    });
    if (!result.receipt || result.receipt.status !== "success") throw new Error(`IOC was not confirmed successful: ${result.hash}`);
    const poolEvidence = decodePoolOrderEvidence(result.receipt, order.pool);
    if (result.orderId !== undefined && poolEvidence.orderId !== result.orderId) throw new Error(`confirmed IOC order ID did not reproduce from pool-scoped logs: ${result.hash}`);
    if (poolEvidence.orderId !== undefined && poolEvidence.restedOrderIds.has(poolEvidence.orderId)) throw new Error(`IOC emitted OrderRested for taker ${poolEvidence.orderId}`);
    if (poolEvidence.orderId !== undefined && await exchange.client.getOrderOnchain(order.pool, poolEvidence.orderId) !== null) throw new Error(`IOC taker ${poolEvidence.orderId} remains active on-chain`);
    const filled = poolEvidence.fills.reduce((sum, fill) => sum + fill.quantityFilled, 0n);
    if (filled === 0n) throw new Error(`IOC confirmed but produced no fill: ${result.hash}`);
    const avg = averageFillPrice(poolEvidence.fills, order.outcome, one);
    const premium = poolEvidence.fills.reduce((sum, fill) => {
      const price = order.outcome === "YES" ? fill.fillPrice : one - fill.fillPrice;
      return sum + premiumAtLimit(fill.quantityFilled, price, one);
    }, 0n);
    if (premium > order.maximumPremiumRaw) throw new Error("confirmed fills exceeded authorized premium");
    const [position, collateralAfter] = await Promise.all([
      this.readOnchainPosition(order.marketId, current.outcomeToken, current.yesId, current.noId, exchange.walletAddress),
      exchange.client.getErc20Balance(current.collateral, exchange.walletAddress),
    ]);
    const positionDeltaRaw = order.outcome === "YES" ? position.yesRaw - positionBefore.yesRaw : position.noRaw - positionBefore.noRaw;
    if (positionDeltaRaw !== filled) throw new Error(`IOC succeeded but position reconciliation failed: delta ${positionDeltaRaw} != filled ${filled}`);
    const oppositeBefore = order.outcome === "YES" ? positionBefore.noRaw : positionBefore.yesRaw;
    const oppositeAfter = order.outcome === "YES" ? position.noRaw : position.yesRaw;
    if (oppositeAfter !== oppositeBefore) throw new Error("IOC succeeded but the opposite outcome position changed unexpectedly");
    const collateralSpentRaw = collateralBalance >= collateralAfter ? collateralBalance - collateralAfter : 0n;
    if (collateralSpentRaw > order.maximumPremiumRaw) throw new Error("IOC succeeded but collateral decrease exceeded the authorization");
    return {
      status: "confirmed",
      txHash: result.hash,
      blockNumber: result.receipt.blockNumber,
      explorerUrl: `${SHANNON_EXPLORER}/tx/${result.hash}`,
      requestedQuantityRaw: order.quantityRaw,
      filledQuantityRaw: filled,
      ...(avg !== undefined ? { averageOutcomePriceRaw: avg } : {}),
      premiumPaidRaw: premium,
      positionBefore,
      positionAfter: position,
      positionDeltaRaw,
      collateralSpentRaw,
      position,
    };
  }

  async readPosition(marketId: Hex, market?: EventMarketSnapshot, account?: Address): Promise<OutcomePosition> {
    if (this.mode !== "live") throw new Error("fixture mode has no wallet position state");
    const exchange = this.requireExchange();
    const owner = account ?? exchange.walletAddress;
    if (!owner) throw new Error("account is required to read a position");
    const current = market ?? (await this.getMarket(marketId));
    return this.readOnchainPosition(marketId, current.outcomeToken, current.yesId, current.noId, owner);
  }

  private async readOnchainPosition(marketId: Hex, outcomeToken: Address, yesId: bigint, noId: bigint, owner: Address): Promise<OutcomePosition> {
    const exchange = this.requireExchange();
    const [yesRaw, noRaw] = await Promise.all([
      exchange.client.getOutcomeBalance({ outcomeToken, account: owner, id: yesId }),
      exchange.client.getOutcomeBalance({ outcomeToken, account: owner, id: noId }),
    ]);
    return { account: owner, marketId, yesRaw, noRaw, readAt: new Date(this.now()).toISOString() };
  }

  private async getAuthorizedOnchain(order: PreparedIocOrder): Promise<MarketOnchain> {
    this.assertVenue(order.venueId);
    const onchain = await this.requireExchange().client.getMarketOnchain(order.marketId);
    if (!sameHex(onchain.pool, order.pool) || onchain.nonce !== order.poolNonce) throw new Error("pre-sign policy failed: pool generation changed");
    if (!sameHex(onchain.outcomeToken, order.outcomeToken) || onchain.yesId !== order.yesId || onchain.noId !== order.noId) {
      throw new Error("pre-sign policy failed: outcome token wiring changed");
    }
    return onchain;
  }

  async discoverFinalized(limit = 40): Promise<FinalizedMarket[]> {
    if (this.mode === "fixture") return [];
    const venueId = this.requireVenue();
    const rows = await this.requireExchange().client.listBinaryMarkets({ venueId, status: "Finalized", limit: Math.min(limit * 3, 200) });
    return rows
      .map((row) => ({
        marketId: row.marketId,
        venueId,
        asset: row.asset,
        intervalSec: Number(row.intervalSec ?? Number(row.expiry) - Number(row.tradingStart)),
        expiry: Number(row.expiry),
        winningOutcome: row.winningOutcome === 0 ? 0 as const : row.winningOutcome === 1 ? 1 as const : null,
        voided: row.voided,
      }))
      .sort((a, b) => b.expiry - a.expiry)
      .slice(0, limit);
  }

  async redeem(marketId: Hex, outcome: Outcome, amountRaw: bigint): Promise<ConfirmedRedemption> {
    return this.serializeWrite(() => this.redeemNow(marketId, outcome, amountRaw));
  }

  private async redeemNow(marketId: Hex, outcome: Outcome, amountRaw: bigint): Promise<ConfirmedRedemption> {
    if (this.mode !== "live") throw new Error("fixture mode is read-only and cannot redeem");
    if (amountRaw <= 0n) throw new RangeError("redemption amount must be positive");
    const exchange = this.requireExchange();
    if (!exchange.walletAddress) throw new Error("a wallet signer is required for redemption");
    const chainId = await exchange.client.getViemClient().getChainId();
    if (chainId !== SHANNON_CHAIN_ID) throw new Error(`write blocked: connected chain ${chainId} is not Shannon`);
    const venueId = this.requireVenue();
    const market = await this.getMarket(marketId);
    this.assertVenue(market.venueId);
    if (market.status !== 4 && market.status !== 5) throw new Error("market is not resolved or voided on-chain");
    const position = await this.readPosition(marketId, market, exchange.walletAddress);
    const available = outcome === "YES" ? position.yesRaw : position.noRaw;
    if (available < amountRaw) throw new Error("redemption exceeds verified outcome balance");
    if (market.status === 4) {
      const onchain = await exchange.client.getMarketOnchain(marketId);
      const winning = onchain.winningOutcome === 0 ? "YES" : "NO";
      if (outcome !== winning) throw new Error("refusing zero-payout redemption of losing outcome");
    }
    const result = await exchange.trader.redeem({
      marketId,
      amount: amountRaw,
      outcomeIdx: outcome === "YES" ? 0 : 1,
      market: market.marketAddress,
      outcomeToken: market.outcomeToken,
      venueId,
    });
    if (!result.receipt || result.receipt.status !== "success") throw new Error(`redemption was not confirmed: ${result.hash}`);
    return {
      status: "confirmed",
      marketId,
      outcome,
      amountRaw,
      txHash: result.hash,
      blockNumber: result.receipt.blockNumber,
      explorerUrl: `${SHANNON_EXPLORER}/tx/${result.hash}`,
    };
  }

  private requireExchange(): SomniaMarkets {
    if (!this.exchange) throw new Error("live exchange is unavailable in fixture mode");
    return this.exchange;
  }

  private async serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeTail;
    let release!: () => void;
    this.writeTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private requireVenue(): Hex {
    if (!this.venueId) throw new Error("venueId is required for writes and finalized-market discovery");
    return this.venueId;
  }

  private assertVenue(marketVenue: Hex): void {
    const configured = this.requireVenue();
    if (!sameHex(configured, marketVenue)) throw new Error(`market venue ${marketVenue} is not configured venue ${configured}`);
  }

  private matchesFilter(market: EventMarketSnapshot, filter: MarketDiscoveryFilter): boolean {
    const secondsLeft = market.expiry - Math.floor(this.now() / 1_000);
    return (
      (!filter.asset || market.asset === filter.asset) &&
      (!filter.intervalSec || market.intervalSec === filter.intervalSec) &&
      secondsLeft >= (filter.minimumSecondsLeft ?? 0)
    );
  }

  private async snapshotFromRow(row: BinaryMarket): Promise<EventMarketSnapshot> {
    const asset = asAsset(row.asset);
    if (!asset) throw new Error(`unsupported event-contract asset: ${row.asset}`);
    if (!row.venueId) throw new Error(`market ${row.marketId} has unknown venue; fail closed`);
    if (this.venueId && !sameHex(this.venueId, row.venueId)) {
      throw new Error(`market venue ${row.venueId} is not configured venue ${this.venueId}`);
    }
    const client = this.requireExchange().client;
    const onchain = await client.getMarketOnchain(row.marketId);
    const metadata = await client.getErc20Metadata(onchain.collateral);
    if (!Number.isSafeInteger(metadata.decimals) || metadata.decimals < 0 || metadata.decimals > 36 || metadata.decimals !== onchain.decimals) {
      throw new Error(`collateral decimals mismatch for ${onchain.collateral}: direct=${metadata.decimals}, market=${onchain.decimals}`);
    }
    return this.combine(row, onchain, asset);
  }

  private combine(row: BinaryMarket, onchain: MarketOnchain, asset: SupportedAsset): EventMarketSnapshot {
    return {
      marketId: row.marketId,
      marketAddress: onchain.marketAddress,
      pool: onchain.pool,
      poolNonce: onchain.nonce,
      outcomeToken: onchain.outcomeToken,
      yesId: onchain.yesId,
      noId: onchain.noId,
      collateral: onchain.collateral,
      collateralDecimals: onchain.decimals,
      asset,
      intervalSec: Number(row.intervalSec ?? Number(row.expiry) - Number(row.tradingStart)),
      tradingStart: Number(row.tradingStart),
      expiry: Number(onchain.expiry),
      venueId: row.venueId!,
      ...(row.operatorId !== null && row.operatorId !== undefined ? { operatorId: row.operatorId } : {}),
      status: onchain.status,
      statusName: statusName(onchain.status),
      question: row.question,
      ...(row.oracleQuestion ? { oracleQuestion: row.oracleQuestion } : {}),
      ...(row.oracleQuestionId ? { oracleQuestionId: row.oracleQuestionId } : {}),
      strikeRaw: row.strike,
      fetchedAt: new Date(this.now()).toISOString(),
      source: "shannon-chain+indexer",
    };
  }
}

export function createShannonAdapter(config: Omit<DreamDexAdapterConfig, "chainId">): DreamDexAdapter {
  return new DreamDexAdapter({ ...config, chainId: SHANNON_CHAIN_ID, venueId: config.venueId ?? DREAMDEX_SHANNON_VENUE });
}
