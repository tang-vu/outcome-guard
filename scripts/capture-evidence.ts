import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { createShannonAdapter, DREAMDEX_SHANNON_VENUE, formatDecimal, type BookParameters, type EventMarketSnapshot as AdapterMarket, type EventOrderBook } from "@outcome-guard/dreamdex";
import { buildHedgePlan } from "@outcome-guard/hedge-engine";
import { evaluatePreview } from "@outcome-guard/policy-engine";
import { canonicalize, sealReceipt, sha256 } from "@outcome-guard/receipt";
import { eventMarketSnapshotSchema, type EventMarketSnapshot, type HedgeIntent } from "@outcome-guard/schemas";

const root = process.cwd();
const evidenceDir = join(root, "docs", "evidence");
const json = (value: unknown) => `${JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item, 2)}\n`;
const save = (file: string, value: unknown) => writeFile(join(evidenceDir, file), json(value), "utf8");
const run = promisify(execFile);

function expiryHeadroom(intervalSec: number): number { return Math.max(30, Math.min(300, intervalSec * 0.4)); }

async function main(): Promise<void> {
  await mkdir(evidenceDir, { recursive: true });
  const capturedAt = new Date().toISOString();
  const [{ stdout: gitCommit }, { stdout: treeStatus }] = await Promise.all([
    run("git", ["rev-parse", "HEAD"], { cwd: root }),
    run("git", ["status", "--porcelain"], { cwd: root })
  ]);
  const capturedFromCommit = gitCommit.trim();
  const sourceTreeClean = treeStatus.trim().length === 0;
  const adapter = createShannonAdapter({ mode: "live", venueId: DREAMDEX_SHANNON_VENUE });
  try {
    const markets = await adapter.discoverMarkets({ asset: "ETH", minimumSecondsLeft: 60, limit: 20 });
    const selected = markets.sort((a, b) => Math.abs(a.intervalSec - 3600) - Math.abs(b.intervalSec - 3600))[0];
    if (!selected) throw new Error("No live ETH DreamDEX market in the explicit venue scope");
    const [book, bookParams] = await Promise.all([adapter.getBook(selected, 20), adapter.getBookParameters(selected)]);
    const market = eventMarketSnapshotSchema.parse(toSchemaMarket(selected, book, bookParams));
    const intent: HedgeIntent = { asset: "ETH", exposureUsd: 1000, horizonMinutes: selected.intervalSec <= 900 ? 15 : 60, adverseMovePct: 2, maxPremium: 15, maxSlippagePct: 2, targetProtectionPct: 75 };
    const plan = buildHedgePlan({ intent, market, constraints: { maxSharesPerMarket: 250, maxTotalPremium: 50, maxPriceImpactPct: 2, maxSpreadPct: 8 } });
    const reproducedPlan = buildHedgePlan({ intent, market, constraints: { maxSharesPerMarket: 250, maxTotalPremium: 50, maxPriceImpactPct: 2, maxSpreadPct: 8 } });
    const receiptInputsReproducible = canonicalize(plan) === canonicalize(reproducedPlan);
    const policies = evaluatePreview({ chainId: 50312, intent, market, plan, now: new Date(), gasBalanceWei: null, totalPremiumAtRisk: null, portfolioAsset: "ETH", portfolioExposureUsd: 1000, portfolioReadKnown: true, humanApproved: false, receiptInputsReproducible, authorizationMarket: market, limits: { maxPremium: 50, maxSharesPerMarket: 250, maxTotalPremiumAtRisk: 100, maxSpreadPct: 8, maxPriceImpactPct: 2, minVisibleDepth: 1, maxSlippagePct: 3, minExpiryHeadroomSec: expiryHeadroom(selected.intervalSec), maxDataStalenessMs: 30_000, snapshotPriceTolerancePct: 1, allowedVenue: DREAMDEX_SHANNON_VENUE, minimumGasBalanceWei: 1n } });
    const receipt = sealReceipt({
      schemaVersion: "1.0.0", createdAt: capturedAt, lifecycleStage: "PRE_EXECUTION", network: { name: "somnia-shannon", chainId: 50312 },
      intent: { originalText: "Protect my 1,000 USD ETH exposure for the next hour. Spend no more than 15 in testnet collateral and do not accept more than 2% slippage.", normalized: intent, intentHash: sha256(canonicalize(intent)) },
      portfolioBefore: { capturedAt, source: "manual-demo", asset: "ETH", exposureUsd: "1000", readStatus: "known" }, marketSnapshot: market, hedgePlan: plan,
      policyEvaluation: policies, authorization: { method: "wallet-signature", signer: "0x0000000000000000000000000000000000000000" }, execution: { status: "NOT_SUBMITTED" }
    });
    const blocker = { schemaVersion: "outcomeguard.external-action-blocker.v1", capturedAt, network: { name: "somnia-shannon", chainId: 50312 }, status: "NOT_PERFORMED", reason: "A disposable funded Shannon signer and explicit human authorization are required. No transaction, fill, settlement, or redemption is claimed.", previousReceiptDigest: receipt.integrity.digest };
    await Promise.all([
      save("environment.json", { capturedAt, capturedFromCommit, sourceTreeClean, captureCommand: "npm run evidence", node: process.version, network: "somnia-shannon", chainId: 50312, sdk: { package: "@somnia-chain/markets-sdk", version: "0.28.1" }, venueId: DREAMDEX_SHANNON_VENUE, rpc: "https://api.infra.testnet.somnia.network", indexer: "https://dev.smk.somnia.host/v1/graphql", collateral: market.collateral, source: "live-read" }),
      save("market-snapshot.json", market), save("hedge-plan.json", plan), save("policy-evaluation.json", policies), save("pre-execution-receipt.json", receipt),
      save("execution-receipt.json", { ...blocker, lifecycle: "EXECUTION" }), save("settlement-receipt.json", { ...blocker, lifecycle: "SETTLEMENT_AND_REDEMPTION" })
    ]);
    console.log(JSON.stringify({ ok: true, marketId: market.marketId, receiptDigest: receipt.integrity.digest, policies: policies.reduce<Record<string, number>>((counts, p) => ({ ...counts, [p.status]: (counts[p.status] ?? 0) + 1 }), {}) }));
  } finally { await Promise.race([adapter.close(), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]); }
}

function toSchemaMarket(market: AdapterMarket, book: EventOrderBook, params: BookParameters): EventMarketSnapshot {
  const dp = market.collateralDecimals;
  return {
    capturedAt: book.capturedAt, source: "live", network: "somnia-shannon", chainId: 50312, sdkVersion: "0.28.1", venueId: market.venueId,
    marketId: market.marketId, poolAddress: market.pool, asset: market.asset, intervalSec: market.intervalSec, strike: market.strikeRaw === "0" ? "0" : market.strikeRaw,
    expiry: new Date(market.expiry * 1000).toISOString(), status: market.statusName === "Unknown" ? "Listed" : market.statusName, statusCode: market.status,
    settlementReference: market.oracleQuestion ?? market.question, ...(market.oracleQuestionId ? { oracleQuestionId: market.oracleQuestionId } : {}),
    collateral: { symbol: "tUSDC", address: market.collateral, decimals: dp },
    book: { yesBids: book.yesBids.map((level) => ({ price: formatDecimal(level.priceRaw, dp), size: formatDecimal(level.quantityRaw, dp) })), yesAsks: book.yesAsks.map((level) => ({ price: formatDecimal(level.priceRaw, dp), size: formatDecimal(level.quantityRaw, dp) })) },
    bookParams: { tickSize: formatDecimal(params.tickSize, dp), lotSize: formatDecimal(params.lotSize, dp), minQuantity: formatDecimal(params.minQuantity, dp) },
    freshnessMs: Math.max(0, Date.now() - Date.parse(book.capturedAt)), ...(book.blockNumber !== undefined ? { blockNumber: book.blockNumber.toString() } : {})
  };
}

void main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
