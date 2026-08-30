import { createHash } from "node:crypto";
import { buildPreparedIoc, createShannonAdapter, formatDecimal, parseDecimal, worstExecutablePriceRaw, type BookParameters, type EventMarketSnapshot as AdapterMarket, type EventOrderBook } from "@outcome-guard/dreamdex";
import { buildHedgePlan } from "@outcome-guard/hedge-engine";
import { evaluatePreview, outcomeGuardPolicyLimits } from "@outcome-guard/policy-engine";
import { computeMandateDigest, computeMarketSnapshotDigest, sealReceipt } from "@outcome-guard/receipt";
import { executionMandateSchema, hedgeIntentSchema, type EventMarketSnapshot, type ExecutionProposal } from "@outcome-guard/schemas";
import { DREAMDEX_VENUE_ID, executionMandateMessage, MARKETS_SDK_VERSION, TESTNET_COLLATERAL } from "@outcome-guard/shared";
import { z } from "zod";

const hash = (value: string) => `0x${createHash("sha256").update(value).digest("hex")}` as const;
const requestSchema = hedgeIntentSchema.extend({ liveMarketId: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional() });

function liveSchemaMarket(market: AdapterMarket, book: EventOrderBook, params: BookParameters): EventMarketSnapshot {
  const decimals = market.collateralDecimals;
  return {
    capturedAt: book.capturedAt, source: "live", network: "somnia-shannon", chainId: 50312, sdkVersion: MARKETS_SDK_VERSION,
    venueId: market.venueId, marketId: market.marketId, poolAddress: market.pool, asset: market.asset, intervalSec: market.intervalSec,
    strike: market.strikeRaw, expiry: new Date(market.expiry * 1000).toISOString(), status: market.statusName === "Unknown" ? "Listed" : market.statusName, statusCode: market.status,
    settlementReference: market.oracleQuestion ?? market.question, ...(market.oracleQuestionId ? { oracleQuestionId: market.oracleQuestionId } : {}),
    collateral: { symbol: "tUSDC", address: market.collateral, decimals },
    book: { yesBids: book.yesBids.map((level) => ({ price: formatDecimal(level.priceRaw, decimals), size: formatDecimal(level.quantityRaw, decimals) })), yesAsks: book.yesAsks.map((level) => ({ price: formatDecimal(level.priceRaw, decimals), size: formatDecimal(level.quantityRaw, decimals) })) },
    bookParams: { tickSize: formatDecimal(params.tickSize, decimals), lotSize: formatDecimal(params.lotSize, decimals), minQuantity: formatDecimal(params.minQuantity, decimals) },
    freshnessMs: Math.max(0, Date.now() - Date.parse(book.capturedAt)), ...(book.blockNumber !== undefined ? { blockNumber: book.blockNumber.toString() } : {})
  };
}

function fixtureMarket(asset: "BTC" | "ETH", horizonMinutes: 15 | 60): EventMarketSnapshot {
  const now = Date.now();
  return {
    capturedAt: new Date(now).toISOString(), source: "fixture", network: "somnia-shannon", chainId: 50312,
    sdkVersion: MARKETS_SDK_VERSION, venueId: DREAMDEX_VENUE_ID, marketId: `0x${asset === "ETH" ? "1" : "2"}${"0".repeat(63)}`,
    poolAddress: `0x${asset === "ETH" ? "e" : "b"}${"0".repeat(39)}`, asset, intervalSec: horizonMinutes * 60,
    strike: asset === "ETH" ? "4512.35" : "118420.20", expiry: new Date(now + horizonMinutes * 60_000).toISOString(),
    status: "Trading", statusCode: 1, settlementReference: "DreamDEX Somnia oracle median at window expiry",
    oracleQuestionId: `fixture-${asset.toLowerCase()}-${horizonMinutes}m`, collateral: TESTNET_COLLATERAL,
    book: { yesBids: [{ price: "0.58", size: "24" }, { price: "0.56", size: "60" }, { price: "0.53", size: "110" }], yesAsks: [{ price: "0.61", size: "40" }, { price: "0.64", size: "80" }] },
    bookParams: { tickSize: "0.001", lotSize: "0.001", minQuantity: "0.001" }, freshnessMs: 80
  };
}

export async function POST(request: Request) {
  let adapter: ReturnType<typeof createShannonAdapter> | undefined;
  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.parse(body);
    const { liveMarketId, ...intent } = parsed;
    let market: EventMarketSnapshot;
    let liveInputs: { market: AdapterMarket; book: EventOrderBook; parameters: BookParameters } | undefined;
    if (liveMarketId) {
      adapter = createShannonAdapter({ mode: "live", venueId: DREAMDEX_VENUE_ID });
      const raw = await adapter.getMarket(liveMarketId as `0x${string}`);
      const [book, parameters] = await Promise.all([adapter.getBook(raw, 20), adapter.getBookParameters(raw)]);
      liveInputs = { market: raw, book, parameters };
      market = liveSchemaMarket(raw, book, parameters);
    } else market = fixtureMarket(intent.asset, intent.horizonMinutes);
    const plan = buildHedgePlan({ intent, market, constraints: { maxSharesPerMarket: 250, maxTotalPremium: 50, maxPriceImpactPct: 2, maxSpreadPct: 8 } });
    const configuredSigner = process.env.AGENT_SIGNER_ADDRESS;
    let executionProposal: ExecutionProposal | undefined;
    if (liveInputs && configuredSigner && /^0x[0-9a-fA-F]{40}$/.test(configuredSigner)) {
      const decimals = liveInputs.market.collateralDecimals;
      const quantityRaw = parseDecimal(plan.normalizedShares.toFixed(decimals), decimals);
      const maximumOutcomePriceRaw = worstExecutablePriceRaw(liveInputs.book.noAsks, quantityRaw);
      const prepared = buildPreparedIoc({
        market: liveInputs.market, book: liveInputs.book, params: liveInputs.parameters, outcome: "NO",
        quantityRaw,
        // The execution limit comes from integer venue units, never from HedgePlan's display-number projection.
        maximumOutcomePriceRaw,
        premiumBudgetRaw: parseDecimal(intent.maxPremium.toString(), decimals),
        maximumBookMoveBps: BigInt(Math.floor(intent.maxSlippagePct * 100)),
        expirySeconds: Math.min(90, Math.max(15, Math.floor(liveInputs.market.intervalSec * 0.05))),
        nowMs: Date.now()
      });
      executionProposal = {
        schemaVersion: "outcomeguard.execution-proposal.v1", chainId: prepared.chainId, venueId: prepared.venueId, marketId: prepared.marketId,
        pool: prepared.pool, poolNonce: prepared.poolNonce.toString(), outcomeToken: prepared.outcomeToken, yesId: prepared.yesId.toString(), noId: prepared.noId.toString(),
        outcome: "NO", side: "BUY_NO", orderType: "IOC", yesPriceRaw: prepared.yesPriceRaw.toString(), outcomePriceRaw: prepared.outcomePriceRaw.toString(),
        quantityRaw: prepared.quantityRaw.toString(), maximumPremiumRaw: prepared.maximumPremiumRaw.toString(), estimatedPremiumRaw: prepared.estimatedPremiumRaw.toString(),
        visibleExecutableQuantityRaw: prepared.visibleExecutableQuantityRaw.toString(), orderExpiryNs: prepared.expireTimestampNs.toString(),
        observedBestAskRaw: prepared.observedBestAskRaw.toString(), maximumBookMoveBps: prepared.maximumBookMoveBps.toString(),
        authorizationFingerprint: prepared.authorizationFingerprint, preparedAt: prepared.preparedAt,
        marketSnapshotDigest: computeMarketSnapshotDigest(market), snapshotCapturedAt: market.capturedAt, executionSigner: configuredSigner
      };
    }
    const policies = evaluatePreview({
      chainId: 50312, intent, market, plan, now: new Date(), gasBalanceWei: null, totalPremiumAtRisk: null, portfolioAsset: intent.asset, portfolioExposureUsd: intent.exposureUsd, portfolioReadKnown: true,
      humanApproved: false, receiptInputsReproducible: true, authorizationMarket: market,
      limits: outcomeGuardPolicyLimits(market.intervalSec)
    });
    const receipt = sealReceipt({
      schemaVersion: "1.0.0", createdAt: new Date().toISOString(), lifecycleStage: "PRE_EXECUTION",
      network: { name: "somnia-shannon", chainId: 50312 }, intent: { normalized: intent, intentHash: hash(JSON.stringify(intent)) },
      portfolioBefore: { capturedAt: new Date().toISOString(), source: "manual-demo", asset: intent.asset, exposureUsd: String(intent.exposureUsd), readStatus: "known" },
      marketSnapshot: market, hedgePlan: plan, ...(executionProposal ? { executionProposal } : {}), policyEvaluation: policies,
      authorization: { method: "wallet-signature", signer: "0x0000000000000000000000000000000000000000" }, execution: { status: "NOT_SUBMITTED" }
    });
    let authorizationChallenge;
    if (executionProposal) {
      const mandate = executionMandateSchema.parse({ ...executionProposal, proposalSchemaVersion: executionProposal.schemaVersion, schemaVersion: "outcomeguard.execution-mandate.v1", receiptDigest: receipt.integrity.digest, receiptId: receipt.receiptId, authorizationDeadline: new Date(Math.min(Date.parse(market.expiry), Date.parse(receipt.createdAt) + 120_000)).toISOString(), autoRedeem: false });
      const mandateDigest = computeMandateDigest(mandate);
      authorizationChallenge = { mandate, mandateDigest, message: executionMandateMessage(mandate, mandateDigest) };
    }
    return Response.json({ mode: liveMarketId ? "live" : "fixture", market, plan, policies, receipt, ...(authorizationChallenge ? { authorizationChallenge } : {}) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  } finally { if (adapter) await Promise.race([adapter.close(), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]); }
}
