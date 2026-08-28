import { readFile } from "node:fs/promises";
import { createShannonAdapter, DREAMDEX_SHANNON_VENUE, formatDecimal, type BookParameters, type EventMarketSnapshot as AdapterMarket, type EventOrderBook, type PreparedIocOrder } from "@outcome-guard/dreamdex";
import { DurableExecutionJournal, executionJobId } from "@outcome-guard/execution-coordinator";
import { evaluatePreSign, mayExecute, outcomeGuardPolicyLimits } from "@outcome-guard/policy-engine";
import { sealReceipt } from "@outcome-guard/receipt";
import { executionBundleSchema, type EventMarketSnapshot, type ExecutionBundle, type PolicyResult } from "@outcome-guard/schemas";
import { MARKETS_SDK_VERSION } from "@outcome-guard/shared";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const envSchema = z.object({
  NETWORK: z.literal("testnet"), CHAIN_ID: z.coerce.number().int().refine((value) => value === 50312), DRY_RUN: z.literal("false"), FIXTURE_MODE: z.literal("false"),
  VENUE_ID: z.string().regex(/^0x[0-9a-fA-F]{64}$/).default(DREAMDEX_SHANNON_VENUE), RPC_URL: z.string().url(), WS_RPC_URL: z.string().url(), INDEXER_URL: z.string().url(),
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/), EXECUTION_STATE_DIR: z.string().min(1),
  INITIAL_TOTAL_PREMIUM_AT_RISK: z.coerce.number().nonnegative().finite()
});

function schemaMarket(market: AdapterMarket, book: EventOrderBook, params: BookParameters): EventMarketSnapshot {
  const decimals = market.collateralDecimals;
  return {
    capturedAt: book.capturedAt, source: "live", network: "somnia-shannon", chainId: 50312, sdkVersion: MARKETS_SDK_VERSION,
    venueId: market.venueId, marketId: market.marketId, poolAddress: market.pool, asset: market.asset, intervalSec: market.intervalSec,
    strike: market.strikeRaw, expiry: new Date(market.expiry * 1000).toISOString(), status: market.statusName === "Unknown" ? "Listed" : market.statusName,
    statusCode: market.status, settlementReference: market.oracleQuestion ?? market.question, ...(market.oracleQuestionId ? { oracleQuestionId: market.oracleQuestionId } : {}),
    collateral: { symbol: "tUSDC", address: market.collateral, decimals },
    book: { yesBids: book.yesBids.map((level) => ({ price: formatDecimal(level.priceRaw, decimals), size: formatDecimal(level.quantityRaw, decimals) })), yesAsks: book.yesAsks.map((level) => ({ price: formatDecimal(level.priceRaw, decimals), size: formatDecimal(level.quantityRaw, decimals) })) },
    bookParams: { tickSize: formatDecimal(params.tickSize, decimals), lotSize: formatDecimal(params.lotSize, decimals), minQuantity: formatDecimal(params.minQuantity, decimals) },
    freshnessMs: Math.max(0, Date.now() - Date.parse(book.capturedAt)), ...(book.blockNumber !== undefined ? { blockNumber: book.blockNumber.toString() } : {})
  };
}

function orderFromBundle(bundle: ExecutionBundle): PreparedIocOrder {
  const mandate = bundle.mandate;
  return {
    chainId: 50312, venueId: mandate.venueId as `0x${string}`, marketId: mandate.marketId as `0x${string}`, pool: mandate.pool as `0x${string}`, poolNonce: BigInt(mandate.poolNonce),
    outcomeToken: mandate.outcomeToken as `0x${string}`, yesId: BigInt(mandate.yesId), noId: BigInt(mandate.noId), outcome: "NO", side: "BUY_NO",
    yesPriceRaw: BigInt(mandate.yesPriceRaw), outcomePriceRaw: BigInt(mandate.outcomePriceRaw), quantityRaw: BigInt(mandate.quantityRaw),
    maximumPremiumRaw: BigInt(mandate.maximumPremiumRaw), estimatedPremiumRaw: BigInt(mandate.estimatedPremiumRaw),
    visibleExecutableQuantityRaw: BigInt(mandate.visibleExecutableQuantityRaw), expireTimestampNs: BigInt(mandate.orderExpiryNs),
    observedBestAskRaw: BigInt(mandate.observedBestAskRaw), maximumBookMoveBps: BigInt(mandate.maximumBookMoveBps),
    authorizationFingerprint: mandate.authorizationFingerprint as `0x${string}`, preparedAt: mandate.preparedAt
  };
}

const safeError = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

async function main(): Promise<void> {
  const config = envSchema.parse(process.env);
  const bundleFlag = process.argv.indexOf("--bundle");
  const bundlePath = bundleFlag >= 0 ? process.argv[bundleFlag + 1] : undefined;
  if (!bundlePath) throw new Error("Usage: npm run execute-once -w @outcome-guard/agent -- --bundle <signed-bundle.json>");
  const bundle = executionBundleSchema.parse(JSON.parse(await readFile(bundlePath, "utf8")));
  const account = privateKeyToAccount(config.PRIVATE_KEY as `0x${string}`);
  if (bundle.mandate.executionSigner.toLowerCase() !== account.address.toLowerCase()) throw new Error("bundle execution signer does not match the loaded disposable key");

  let freshPolicies: PolicyResult[] = [];
  const adapter = createShannonAdapter({
    mode: "live", venueId: config.VENUE_ID as `0x${string}`, rpcUrl: config.RPC_URL, wsRpcUrl: config.WS_RPC_URL, indexerUrl: config.INDEXER_URL,
    privateKey: config.PRIVATE_KEY as `0x${string}`,
    executionGuard: async (order) => {
      if (order.authorizationFingerprint.toLowerCase() !== bundle.mandate.authorizationFingerprint.toLowerCase()) throw new Error("adapter order fingerprint differs from the human mandate");
      return { orderFingerprint: bundle.mandate.authorizationFingerprint as `0x${string}`, receiptDigest: bundle.authorizedReceipt.integrity.digest as `0x${string}`, verifiedHumanSignature: true, policyStatuses: freshPolicies.map(({ status }) => status), authorizedChainId: 50312, expiresAtMs: Date.parse(bundle.mandate.authorizationDeadline) };
    }
  });
  const journal = new DurableExecutionJournal(config.EXECUTION_STATE_DIR, account.address);
  let submissionRecorded = false;
  let lockAcquired = false;
  let knownTxHash: `0x${string}` | undefined;
  let knownBlockNumber: bigint | undefined;
  try {
    await journal.initialize(); await journal.acquireSignerLock(); lockAcquired = true;
    const market = await adapter.getMarket(bundle.mandate.marketId as `0x${string}`);
    const [book, params, gasBalance] = await Promise.all([adapter.getBook(market, 20), adapter.getBookParameters(market), adapter.exchange!.client.getViemClient().getBalance({ address: account.address })]);
    const freshMarket = schemaMarket(market, book, params);
    freshPolicies = evaluatePreSign({
      chainId: 50312, intent: bundle.preExecutionReceipt.intent.normalized, market: freshMarket, plan: bundle.preExecutionReceipt.hedgePlan,
      limits: outcomeGuardPolicyLimits(freshMarket.intervalSec), now: new Date(), gasBalanceWei: gasBalance, totalPremiumAtRisk: config.INITIAL_TOTAL_PREMIUM_AT_RISK,
      portfolioAsset: bundle.preExecutionReceipt.portfolioBefore.asset, portfolioExposureUsd: Number(bundle.preExecutionReceipt.portfolioBefore.exposureUsd),
      portfolioReadKnown: bundle.preExecutionReceipt.portfolioBefore.readStatus === "known", humanApproved: true, receiptInputsReproducible: true,
      authorizationMarket: bundle.preExecutionReceipt.marketSnapshot
    });
    if (!mayExecute(freshPolicies)) throw new Error(`fresh pre-sign policy blocked execution: ${freshPolicies.filter(({ status }) => status === "FAIL").map(({ policyId }) => policyId).join(", ")}`);
    const { jobId } = await journal.claimBundle(bundle);
    await journal.append({ event: "PREFLIGHT_PASSED", jobId, signer: account.address, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint });
    await journal.append({ event: "SUBMISSION_INTENT_RECORDED", jobId, signer: account.address, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint });
    submissionRecorded = true;
    const result = await adapter.executeBoundedIoc(orderFromBundle(bundle));
    knownTxHash = result.txHash; knownBlockNumber = result.blockNumber;
    await journal.append({ event: "TX_MINED_SUCCESS", jobId, signer: account.address, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint, txHash: result.txHash, blockNumber: result.blockNumber.toString() });
    await journal.append({ event: "POSITION_RECONCILED", jobId, signer: account.address, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint, txHash: result.txHash, blockNumber: result.blockNumber.toString() });
    const decimals = market.collateralDecimals;
    const { integrity: _integrity, receiptId: _receiptId, ...authorizedBody } = bundle.authorizedReceipt;
    void _integrity; void _receiptId;
    const executionReceipt = sealReceipt({
      ...authorizedBody, createdAt: new Date().toISOString(), lifecycleStage: "EXECUTION", marketSnapshot: freshMarket, policyEvaluation: freshPolicies,
      execution: { status: "RECONCILED", txHash: result.txHash, blockNumber: result.blockNumber.toString(), requestedPrice: formatDecimal(BigInt(bundle.mandate.outcomePriceRaw), decimals), ...(result.averageOutcomePriceRaw !== undefined ? { averageFillPrice: formatDecimal(result.averageOutcomePriceRaw, decimals) } : {}), requestedSize: formatDecimal(result.requestedQuantityRaw, decimals), filledSize: formatDecimal(result.filledQuantityRaw, decimals), explorerUrl: result.explorerUrl,
        position: { marketId: bundle.mandate.marketId, account: result.position.account, yesBefore: formatDecimal(result.positionBefore.yesRaw, decimals), noBefore: formatDecimal(result.positionBefore.noRaw, decimals), yesAfter: formatDecimal(result.positionAfter.yesRaw, decimals), noAfter: formatDecimal(result.positionAfter.noRaw, decimals), filledOutcome: "NO", positionDelta: formatDecimal(result.positionDeltaRaw, decimals), collateralSpent: formatDecimal(result.collateralSpentRaw, decimals) } },
      portfolioAfter: { ...bundle.authorizedReceipt.portfolioBefore, capturedAt: new Date().toISOString() }, previousReceiptDigest: bundle.authorizedReceipt.integrity.digest
    });
    const receiptPath = await journal.persistReceipt(jobId, executionReceipt);
    await journal.append({ event: "RECEIPT_SEALED", jobId, signer: account.address, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint, txHash: result.txHash, blockNumber: result.blockNumber.toString(), evidenceDigest: executionReceipt.integrity.digest });
    await journal.releaseSignerLock(); lockAcquired = false;
    console.log(JSON.stringify({ status: "RECONCILED", jobId: executionJobId(bundle), txHash: result.txHash, receiptDigest: executionReceipt.integrity.digest, receiptPath, explorerUrl: result.explorerUrl }));
  } catch (error) {
    if (submissionRecorded) {
      const jobId = executionJobId(bundle);
      await journal.append({ event: "AMBIGUOUS_SUBMISSION", jobId, signer: account.address, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint, ...(knownTxHash ? { txHash: knownTxHash } : {}), ...(knownBlockNumber !== undefined ? { blockNumber: knownBlockNumber.toString() } : {}), detail: safeError(error) }).catch(() => undefined);
      lockAcquired = false;
      throw new Error(`submission outcome requires manual chain and nonce reconciliation; signer lock retained${knownTxHash ? `; known tx ${knownTxHash}` : ""}: ${safeError(error)}`, { cause: error });
    }
    throw error;
  } finally {
    if (lockAcquired) await journal.releaseSignerLock().catch(() => undefined);
    await adapter.close();
  }
}

void main().catch((error) => { console.error(JSON.stringify({ status: "FAILED", error: safeError(error) })); process.exitCode = 1; });
