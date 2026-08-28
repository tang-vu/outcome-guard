import { describe, expect, it } from "vitest";
import { DreamDexAdapter } from "../src/adapter.js";
import { deterministicFixture } from "../src/fixtures.js";
import { buildPreparedIoc, floorToStep, parseDecimal, premiumAtLimit, stableFingerprint } from "../src/math.js";

describe("DreamDEX exact-unit order construction", () => {
  const market = deterministicFixture.markets[0]!;
  const book = deterministicFixture.books[market.marketId]!;
  const params = deterministicFixture.bookParameters[market.marketId]!;

  it("parses decimal input without floating point", () => {
    expect(parseDecimal("15", 6)).toBe(15_000_000n);
    expect(parseDecimal("0.048", 6)).toBe(48_000n);
    expect(() => parseDecimal("0.0000001", 6)).toThrow();
  });

  it("rounds quantities down and never exceeds the premium budget", () => {
    const order = buildPreparedIoc({
      market,
      book,
      params,
      outcome: "NO",
      quantityRaw: 20_000_001n,
      maximumOutcomePriceRaw: 480_999n,
      premiumBudgetRaw: 9_620_000n,
      maximumBookMoveBps: 200n,
      expirySeconds: 300,
      nowMs: Date.parse("2026-08-28T00:00:00.000Z"),
    });
    expect(order.outcomePriceRaw).toBe(480_000n);
    expect(order.yesPriceRaw).toBe(520_000n);
    expect(order.estimatedPremiumRaw).toBeLessThanOrEqual(order.maximumPremiumRaw);
    expect(order.quantityRaw).toBe(floorToStep(20_000_001n, params.lotSize));
  });

  it("fails closed above visible executable depth", () => {
    expect(() => buildPreparedIoc({
      market,
      book,
      params,
      outcome: "NO",
      quantityRaw: 60_000_000n,
      maximumOutcomePriceRaw: 500_000n,
      premiumBudgetRaw: 30_000_000n,
      maximumBookMoveBps: 200n,
      expirySeconds: 300,
      nowMs: Date.parse("2026-08-28T00:00:00.000Z"),
    })).toThrow(/visible depth/);
  });

  it("uses ceiling premium math and stable fingerprints", () => {
    expect(premiumAtLimit(3n, 500_001n, 1_000_000n)).toBe(2n);
    expect(stableFingerprint({ b: 2n, a: 1 })).toBe(stableFingerprint({ a: 1, b: 2n }));
  });

  it("rejects a NO price whose complemented YES call price is off-grid", () => {
    expect(() => buildPreparedIoc({
      market, book, params: { ...params, tickSize: 3_000n }, outcome: "NO",
      quantityRaw: 1_000_000n, maximumOutcomePriceRaw: 480_000n, premiumBudgetRaw: 500_000n,
      maximumBookMoveBps: 200n, expirySeconds: 300, nowMs: Date.parse("2026-08-28T00:00:00.000Z")
    })).toThrow(/YES price.*tick/);
  });

  it("cannot reach a write without a policy-and-signature execution guard", async () => {
    const order = buildPreparedIoc({
      market,
      book,
      params,
      outcome: "NO",
      quantityRaw: 1_000_000n,
      maximumOutcomePriceRaw: 500_000n,
      premiumBudgetRaw: 500_000n,
      maximumBookMoveBps: 200n,
      expirySeconds: 300,
      nowMs: Date.parse("2026-08-28T00:00:00.000Z"),
    });
    const adapter = new DreamDexAdapter({ mode: "fixture", now: () => Date.parse("2026-08-28T00:00:00.000Z") });
    await expect(adapter.executeBoundedIoc(order)).rejects.toThrow(/execution guard/);
  });
});
