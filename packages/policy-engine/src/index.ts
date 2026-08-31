import type { EventMarketSnapshot, HedgeIntent, HedgePlan, JsonValue, PolicyResult } from "@outcome-guard/schemas";
import { DREAMDEX_VENUE_ID, SHANNON_CHAIN_ID } from "@outcome-guard/shared";

export type PolicyLimits = {
  maxPremium: number;
  maxSharesPerMarket: number;
  maxTotalPremiumAtRisk: number;
  maxSpreadPct: number;
  maxPriceImpactPct: number;
  minVisibleDepth: number;
  maxSlippagePct: number;
  minExpiryHeadroomSec: number;
  maxDataStalenessMs: number;
  snapshotPriceTolerancePct: number;
  allowedVenue: string;
  minimumGasBalanceWei: bigint;
};

export type PolicyContext = {
  chainId: number;
  intent: HedgeIntent;
  market: EventMarketSnapshot;
  plan: HedgePlan;
  limits: PolicyLimits;
  now: Date;
  gasBalanceWei: bigint | null;
  totalPremiumAtRisk: number | null;
  portfolioAsset: "BTC" | "ETH" | null;
  portfolioExposureUsd: number | null;
  portfolioReadKnown: boolean;
  humanApproved: boolean;
  receiptInputsReproducible: boolean;
  authorizationMarket?: EventMarketSnapshot;
};

export function outcomeGuardPolicyLimits(intervalSec: number): PolicyLimits {
  return {
    maxPremium: 50, maxSharesPerMarket: 250, maxTotalPremiumAtRisk: 100, maxSpreadPct: 8, maxPriceImpactPct: 2,
    minVisibleDepth: 10, maxSlippagePct: 3, minExpiryHeadroomSec: Math.max(30, Math.min(300, intervalSec * 0.4)),
    maxDataStalenessMs: 10_000, snapshotPriceTolerancePct: 1, allowedVenue: DREAMDEX_VENUE_ID, minimumGasBalanceWei: 1n
  };
}

const result = (policyId: string, status: PolicyResult["status"], observed: JsonValue, limit: JsonValue, reason: string, evidenceRefs: string[] = []): PolicyResult => ({
  policyId, version: "1.0.0", status, observed, limit, reason, evidenceRefs
});
const passFail = (id: string, pass: boolean, observed: JsonValue, limit: JsonValue, passReason: string, failReason: string, refs: string[] = []): PolicyResult =>
  result(id, pass ? "PASS" : "FAIL", observed, limit, pass ? passReason : failReason, refs);

function downSpreadPct(market: EventMarketSnapshot): number | null {
  const bid = Number(market.book.yesBids[0]?.price);
  const ask = Number(market.book.yesAsks[0]?.price);
  if (!(bid > 0) || !(ask > 0) || ask < bid) return null;
  const midpoint = 1 - ((ask + bid) / 2);
  if (!(midpoint > 0)) return null;
  return ((ask - bid) / midpoint) * 100;
}

export function evaluatePolicies(ctx: PolicyContext): PolicyResult[] {
  const { market, plan, intent, limits } = ctx;
  const authorizedDownAsk = ctx.authorizationMarket?.book.yesBids[0] ? 1 - Number(ctx.authorizationMarket.book.yesBids[0].price) : null;
  const executionTolerancePct = Math.min(intent.maxSlippagePct, limits.maxPriceImpactPct);
  const authorizedMaximumDownPrice = authorizedDownAsk === null ? plan.worstPrice : authorizedDownAsk * (1 + executionTolerancePct / 100);
  const depth = market.book.yesBids.filter((level) => 1 - Number(level.price) <= authorizedMaximumDownPrice + Number.EPSILON).reduce((sum, level) => sum + Number(level.size), 0);
  const spread = downSpreadPct(market);
  const expiryHeadroom = (Date.parse(market.expiry) - ctx.now.getTime()) / 1000;
  const priceImpact = market.book.yesBids[0] ? Math.max(0, ((plan.worstPrice - (1 - Number(market.book.yesBids[0].price))) / (1 - Number(market.book.yesBids[0].price))) * 100) : Number.POSITIVE_INFINITY;
  const freshDownAsk = market.book.yesBids[0] ? 1 - Number(market.book.yesBids[0].price) : null;
  const snapshotPriceChange = authorizedDownAsk !== null && freshDownAsk !== null
    ? Math.abs(freshDownAsk - authorizedDownAsk) / Math.max(authorizedDownAsk, Number.EPSILON) * 100
    : Number.POSITIVE_INFINITY;

  return [
    passFail("network.testnet-only", ctx.chainId === SHANNON_CHAIN_ID && market.chainId === SHANNON_CHAIN_ID, { requested: ctx.chainId, market: market.chainId }, SHANNON_CHAIN_ID, "Execution is scoped to Shannon.", "Mainnet or ambiguous network is forbidden."),
    passFail("asset.allowed", intent.asset === "BTC" || intent.asset === "ETH", intent.asset, ["BTC", "ETH"], "Underlying is allowed.", "Underlying is not allowed."),
    passFail("asset.market-match", intent.asset === market.asset, { intent: intent.asset, market: market.asset }, "equal", "Intent and market underlying match.", "Intent underlying does not match the selected market."),
    passFail("portfolio.intent-match", ctx.portfolioReadKnown && ctx.portfolioAsset === intent.asset && ctx.portfolioExposureUsd === intent.exposureUsd, { known: ctx.portfolioReadKnown, asset: ctx.portfolioAsset, exposureUsd: ctx.portfolioExposureUsd }, { asset: intent.asset, exposureUsd: intent.exposureUsd }, "Portfolio snapshot matches the normalized intent.", "Portfolio snapshot is unknown or does not match the normalized intent."),
    passFail("horizon.market-match", intent.horizonMinutes * 60 === market.intervalSec, { intentSec: intent.horizonMinutes * 60, marketSec: market.intervalSec }, "equal", "Intent horizon matches the market interval.", "Intent horizon does not match the selected market interval."),
    passFail("plan.market-match", plan.marketId.toLowerCase() === market.marketId.toLowerCase(), { plan: plan.marketId, market: market.marketId }, "equal", "Plan is bound to this market ID.", "Plan market ID does not match the fresh snapshot."),
    passFail("premium.user-budget", plan.premiumUsd <= Math.min(intent.maxPremium, limits.maxPremium), plan.premiumUsd, Math.min(intent.maxPremium, limits.maxPremium), "Premium fits the authorized budget.", "Premium exceeds the authorized budget."),
    passFail("shares.per-market", plan.normalizedShares <= limits.maxSharesPerMarket, plan.normalizedShares, limits.maxSharesPerMarket, "Share size is within the market cap.", "Share size exceeds the market cap."),
    passFail("premium.total-risk", ctx.totalPremiumAtRisk !== null && ctx.totalPremiumAtRisk + plan.premiumUsd <= limits.maxTotalPremiumAtRisk, ctx.totalPremiumAtRisk, limits.maxTotalPremiumAtRisk, "Total premium risk remains within limit.", ctx.totalPremiumAtRisk === null ? "Existing premium risk is unknown; execution fails closed." : "Total premium risk would exceed the limit."),
    passFail("book.spread", spread !== null && spread <= limits.maxSpreadPct, spread, limits.maxSpreadPct, "Executable DOWN spread is within limit.", spread === null ? "DOWN spread is unknown because one book side is missing or invalid." : "Executable DOWN spread exceeds the limit."),
    passFail("book.price-impact", priceImpact <= limits.maxPriceImpactPct, priceImpact, limits.maxPriceImpactPct, "Price impact is within limit.", "Price impact exceeds the limit."),
    passFail("book.visible-depth", depth >= Math.max(limits.minVisibleDepth, plan.normalizedShares), depth, Math.max(limits.minVisibleDepth, plan.normalizedShares), "Visible depth covers the normalized order.", "Visible depth is insufficient."),
    passFail("order.slippage", intent.maxSlippagePct <= limits.maxSlippagePct, intent.maxSlippagePct, limits.maxSlippagePct, "User slippage is within policy.", "User slippage exceeds policy."),
    passFail("market.expiry-headroom", expiryHeadroom >= limits.minExpiryHeadroomSec, expiryHeadroom, limits.minExpiryHeadroomSec, "Market has sufficient expiry headroom.", "Market is too close to expiry."),
    passFail("market.freshness", market.freshnessMs <= limits.maxDataStalenessMs, market.freshnessMs, limits.maxDataStalenessMs, "Snapshot is fresh.", "Snapshot is stale."),
    passFail("market.onchain-status", market.statusCode === 1 && market.status === "Trading", { code: market.statusCode, status: market.status }, { code: 1, status: "Trading" }, "On-chain status is Trading.", "On-chain market is not Trading."),
    passFail("venue.allowed", market.venueId.toLowerCase() === limits.allowedVenue.toLowerCase() && limits.allowedVenue.toLowerCase() === DREAMDEX_VENUE_ID.toLowerCase(), market.venueId, limits.allowedVenue, "Venue matches the explicit DreamDEX scope.", "Venue is ambiguous or not allowed."),
    passFail("wallet.gas", ctx.gasBalanceWei !== null && ctx.gasBalanceWei >= limits.minimumGasBalanceWei, ctx.gasBalanceWei?.toString() ?? "unknown", limits.minimumGasBalanceWei.toString(), "Gas reserve is sufficient.", ctx.gasBalanceWei === null ? "Gas balance is unknown; execution fails closed." : "Gas reserve is insufficient."),
    passFail("order.non-zero", plan.normalizedShares > 0, plan.normalizedShares, "> 0", "Normalized order is non-zero.", "Normalization produced a zero-sized order."),
    passFail("authorization.human", ctx.humanApproved, ctx.humanApproved, true, "Human authorization is present.", "Human authorization is required."),
    passFail("authorization.snapshot-tolerance", ctx.authorizationMarket !== undefined && snapshotPriceChange <= limits.snapshotPriceTolerancePct, ctx.authorizationMarket ? snapshotPriceChange : "missing", limits.snapshotPriceTolerancePct, "Current market remains within the authorized tolerance.", ctx.authorizationMarket ? "Market changed beyond the authorization tolerance." : "Authorized market snapshot is missing; execution fails closed."),
    passFail("receipt.reproducible", ctx.receiptInputsReproducible, ctx.receiptInputsReproducible, true, "Receipt inputs reproduce deterministically.", "Receipt inputs cannot be reproduced; signing is blocked.")
  ];
}

export const mayExecute = (results: PolicyResult[]): boolean => results.every(({ status }) => status !== "FAIL");

/** Preview and pre-sign intentionally call the same evaluator; only fresh context and approval differ. */
export const evaluatePreview = evaluatePolicies;
export const evaluatePreSign = evaluatePolicies;
