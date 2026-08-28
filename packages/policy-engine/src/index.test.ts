import { describe, expect, it } from "vitest";
import { evaluatePolicies, evaluatePreSign, evaluatePreview, mayExecute, type PolicyContext } from "./index.js";

const context = {
  chainId: 50312,
  intent: { asset: "ETH", exposureUsd: 1000, horizonMinutes: 60, adverseMovePct: 2, maxPremium: 15, maxSlippagePct: 2, targetProtectionPct: 75 },
  market: { capturedAt: "2026-08-28T06:00:00.000Z", source: "fixture", network: "somnia-shannon", chainId: 50312, sdkVersion: "0.28.1", venueId: "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c", marketId: `0x${"1".repeat(64)}`, poolAddress: `0x${"2".repeat(40)}`, asset: "ETH", intervalSec: 3600, strike: "4500", expiry: "2026-08-28T07:00:00.000Z", status: "Trading", statusCode: 1, settlementReference: "oracle", collateral: { symbol: "tUSDC", address: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E", decimals: 6 }, book: { yesBids: [{ price: "0.58", size: "100" }], yesAsks: [{ price: "0.60", size: "100" }] }, bookParams: { tickSize: "0.001", lotSize: "0.001", minQuantity: "0.001" }, freshnessMs: 100 },
  plan: { planVersion: "1.0.0", objective: "BUY_DOWN_PROTECTION", marketId: `0x${"1".repeat(64)}`, requestedShares: 30, executableShares: 30, normalizedShares: 30, worstPrice: 0.42, averageExecutablePrice: 0.42, premiumUsd: 12.6, expectedNetPayoutIfDownUsd: 17.4, targetProtectedLossUsd: 15, constraints: [], scenarios: [], basisRiskWarning: "Binary basis risk exists." },
  limits: { maxPremium: 15, maxSharesPerMarket: 100, maxTotalPremiumAtRisk: 50, maxSpreadPct: 5, maxPriceImpactPct: 2, minVisibleDepth: 10, maxSlippagePct: 2, minExpiryHeadroomSec: 30, maxDataStalenessMs: 5000, snapshotPriceTolerancePct: 1, allowedVenue: "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c", minimumGasBalanceWei: 1n },
  now: new Date("2026-08-28T06:00:00.000Z"), gasBalanceWei: 1n, totalPremiumAtRisk: 0, portfolioAsset: "ETH", portfolioExposureUsd: 1000, portfolioReadKnown: true, humanApproved: true, receiptInputsReproducible: true
} as PolicyContext;

context.authorizationMarket = context.market;

describe("policy gate", () => {
  it("uses the exact same evaluator for preview and pre-sign", () => {
    expect(evaluatePreview).toBe(evaluatePreSign);
    expect(evaluatePreview(context)).toEqual(evaluatePreSign(context));
  });
  it("blocks unknown balances and failed policies", () => {
    const results = evaluatePolicies({ ...context, gasBalanceWei: null });
    expect(mayExecute(results)).toBe(false);
    expect(results.find((p) => p.policyId === "wallet.gas")?.status).toBe("FAIL");
  });
  it("blocks mainnet", () => expect(mayExecute(evaluatePolicies({ ...context, chainId: 5031 }))).toBe(false));
  it("blocks a changed authorized snapshot", () => {
    const changed = { ...context.market, book: { ...context.market.book, yesBids: [{ price: "0.50", size: "100" }] } };
    const results = evaluatePolicies({ ...context, market: changed, authorizationMarket: context.market });
    expect(results.find((p) => p.policyId === "authorization.snapshot-tolerance")?.status).toBe("FAIL");
  });
  it("binds asset, horizon, plan market, and the authorization snapshot", () => {
    const withoutAuthorizationMarket = { ...context };
    delete withoutAuthorizationMarket.authorizationMarket;
    expect(mayExecute(evaluatePolicies(withoutAuthorizationMarket))).toBe(false);
    expect(mayExecute(evaluatePolicies({ ...context, intent: { ...context.intent, asset: "BTC" } }))).toBe(false);
    expect(mayExecute(evaluatePolicies({ ...context, portfolioReadKnown: false }))).toBe(false);
    expect(mayExecute(evaluatePolicies({ ...context, plan: { ...context.plan, marketId: `0x${"9".repeat(64)}` } }))).toBe(false);
  });
});
