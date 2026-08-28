import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EventMarketSnapshot, HedgeIntent } from "@outcome-guard/schemas";
import { buildHedgePlan, quantizeDown } from "./index.js";

const market: EventMarketSnapshot = {
  capturedAt: "2026-08-28T06:00:00.000Z", source: "fixture", network: "somnia-shannon", chainId: 50312,
  sdkVersion: "0.28.1", venueId: "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c",
  marketId: `0x${"1".repeat(64)}`, poolAddress: `0x${"2".repeat(40)}`, asset: "ETH", intervalSec: 3600,
  strike: "4500", expiry: "2026-08-28T07:00:00.000Z", status: "Trading", statusCode: 1,
  settlementReference: "DreamDEX oracle ETH/USD", collateral: { symbol: "tUSDC", address: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E", decimals: 6 },
  book: { yesBids: [{ price: "0.58", size: "100" }, { price: "0.55", size: "200" }], yesAsks: [{ price: "0.61", size: "100" }] },
  bookParams: { tickSize: "0.001", lotSize: "0.001", minQuantity: "0.001" }, freshnessMs: 100
};
const baseIntent: HedgeIntent = { asset: "ETH", exposureUsd: 1000, horizonMinutes: 60, adverseMovePct: 2, maxPremium: 15, maxSlippagePct: 2, targetProtectionPct: 75 };
const limits = { maxSharesPerMarket: 500, maxTotalPremium: 100, maxPriceImpactPct: 2, maxSpreadPct: 5 };

describe("hedge sizing", () => {
  it("never exceeds the authorized premium budget after quantization", () => {
    fc.assert(fc.property(fc.double({ min: 0.01, max: 100, noNaN: true }), (budget) => {
      const plan = buildHedgePlan({ intent: { ...baseIntent, maxPremium: budget }, market, constraints: limits });
      expect(plan.premiumUsd).toBeLessThanOrEqual(Math.round(budget * 100) / 100 + 0.01);
      expect(plan.executableShares).toBeLessThanOrEqual(300);
    }));
  });

  it("always quantizes downward", () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 10_000, noNaN: true }), (value) => {
      const q = quantizeDown(value, 0.001);
      expect(q).toBeLessThanOrEqual(value + 1e-10);
      expect(Math.abs(q * 1000 - Math.round(q * 1000))).toBeLessThan(1e-8);
    }));
  });
});
