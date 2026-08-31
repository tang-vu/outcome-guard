import type { EventMarketSnapshot, HedgeIntent, HedgePlan } from "@outcome-guard/schemas";
import { roundMoney } from "@outcome-guard/shared";

export type HedgeConstraints = {
  maxSharesPerMarket: number;
  maxTotalPremium: number;
  maxPriceImpactPct: number;
  maxSpreadPct: number;
};

type Level = { price: number; size: number };

const finitePositive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
};

/** Convert YES bids into immediately executable NO asks. No floating-point value is ever sent on-chain. */
export function downAskLevels(snapshot: EventMarketSnapshot): Level[] {
  return snapshot.book.yesBids
    .map(({ price, size }) => ({ price: 1 - Number(price), size: Number(size) }))
    .filter((level) => level.price > 0 && level.price < 1 && level.size > 0)
    .sort((a, b) => a.price - b.price);
}

export function quantizeDown(value: number, lotSize: number): number {
  finitePositive("lotSize", lotSize);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const lots = Math.floor((value + Number.EPSILON) / lotSize);
  return Number((lots * lotSize).toPrecision(15));
}

export function fillBook(levels: Level[], shares: number, maxPrice: number): { shares: number; premium: number; averagePrice: number; worstPrice: number } {
  let remaining = Math.max(0, shares);
  let filled = 0;
  let premium = 0;
  let worstPrice = 0;
  for (const level of levels) {
    if (level.price > maxPrice || remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    filled += take;
    premium += take * level.price;
    worstPrice = level.price;
    remaining -= take;
  }
  return { shares: filled, premium, averagePrice: filled > 0 ? premium / filled : 0, worstPrice };
}

function sharesForBudget(levels: Level[], budget: number, maxPrice: number): number {
  let remaining = Math.max(0, budget);
  let shares = 0;
  for (const level of levels) {
    if (level.price > maxPrice || remaining <= 0) break;
    const affordable = remaining / level.price;
    const take = Math.min(level.size, affordable);
    shares += take;
    remaining -= take * level.price;
  }
  return shares;
}

export function buildHedgePlan(args: {
  intent: HedgeIntent;
  market: EventMarketSnapshot;
  constraints: HedgeConstraints;
}): HedgePlan {
  const { intent, market, constraints } = args;
  finitePositive("exposureUsd", intent.exposureUsd);
  const levels = downAskLevels(market);
  if (levels.length === 0) throw new Error("No executable DOWN liquidity is visible");
  const best = levels[0]!;
  const maxPrice = Math.min(0.999999, best.price * (1 + intent.maxSlippagePct / 100), best.price * (1 + constraints.maxPriceImpactPct / 100));
  const targetProtectedLoss = intent.exposureUsd * (intent.adverseMovePct / 100) * (intent.targetProtectionPct / 100);
  const requestedShares = targetProtectedLoss / (1 - best.price);
  const budget = Math.min(intent.maxPremium, constraints.maxTotalPremium);
  const depthShares = levels.filter((level) => level.price <= maxPrice).reduce((sum, level) => sum + level.size, 0);
  // Reserve the full authorized slippage envelope. This keeps the raw IOC below budget
  // even if the book moves from the preview ask to the user's maximum accepted price.
  const budgetShares = Math.min(sharesForBudget(levels, budget, maxPrice), budget / maxPrice);
  const beforeQuantization = Math.min(requestedShares, budgetShares, depthShares, constraints.maxSharesPerMarket);
  const lotSize = Number(market.bookParams.lotSize);
  const minQuantity = Number(market.bookParams.minQuantity);
  const normalizedShares = quantizeDown(beforeQuantization, lotSize);
  const executableShares = normalizedShares >= minQuantity ? normalizedShares : 0;
  const fill = fillBook(levels, executableShares, maxPrice);
  const premium = fill.premium;
  const netPayout = fill.shares - premium;
  const scenarioMoves = [-intent.adverseMovePct, -1, -0.5, 0, 1].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  const scenarios = scenarioMoves.map((move) => {
    const underlyingPnlUsd = intent.exposureUsd * move / 100;
    const eventPayoutUsd = move < 0 ? fill.shares : 0;
    const hedgedPnlUsd = underlyingPnlUsd + eventPayoutUsd - premium;
    const unhedgedLoss = Math.max(0, -underlyingPnlUsd);
    const hedgedLoss = Math.max(0, -hedgedPnlUsd);
    return {
      adverseMovePct: move,
      contractOutcome: move < 0 ? "DOWN" as const : "UP" as const,
      underlyingPnlUsd: roundMoney(underlyingPnlUsd),
      eventPayoutUsd: roundMoney(eventPayoutUsd),
      premiumUsd: roundMoney(premium),
      hedgedPnlUsd: roundMoney(hedgedPnlUsd),
      protectionRatioPct: unhedgedLoss > 0 ? Math.max(0, Math.min(100, ((unhedgedLoss - hedgedLoss) / unhedgedLoss) * 100)) : 0
    };
  });
  const constraintsApplied = [
    { name: "target", before: requestedShares, after: requestedShares, binding: false },
    { name: "premium-budget", before: requestedShares, after: budgetShares, binding: budgetShares < requestedShares },
    { name: "visible-depth", before: requestedShares, after: depthShares, binding: depthShares < requestedShares },
    { name: "per-market-cap", before: requestedShares, after: constraints.maxSharesPerMarket, binding: constraints.maxSharesPerMarket < requestedShares },
    { name: "lot-and-minimum", before: beforeQuantization, after: executableShares, binding: executableShares !== beforeQuantization }
  ];
  return {
    planVersion: "1.0.0",
    objective: "BUY_DOWN_PROTECTION",
    marketId: market.marketId,
    requestedShares,
    executableShares: fill.shares,
    normalizedShares: executableShares,
    worstPrice: fill.worstPrice || best.price,
    averageExecutablePrice: fill.averagePrice || best.price,
    premiumUsd: roundMoney(premium),
    expectedNetPayoutIfDownUsd: roundMoney(Math.max(0, netPayout)),
    targetProtectedLossUsd: roundMoney(targetProtectedLoss),
    constraints: constraintsApplied,
    scenarios,
    basisRiskWarning: "Binary protection pays only if the market resolves DOWN. It is nonlinear and may not track spot losses because of strike, timing, oracle, liquidity, and settlement basis risk."
  };
}
