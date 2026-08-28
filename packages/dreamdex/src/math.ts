import { keccak256, toHex, type Hex } from "viem";
import type { BookLevel, BookParameters, EventMarketSnapshot, EventOrderBook, Outcome, PreparedIocOrder } from "./types";

export function floorToStep(value: bigint, step: bigint): bigint {
  if (value < 0n || step <= 0n) throw new RangeError("value must be non-negative and step positive");
  return (value / step) * step;
}

export function ceilDiv(value: bigint, divisor: bigint): bigint {
  if (value < 0n || divisor <= 0n) throw new RangeError("value must be non-negative and divisor positive");
  return value === 0n ? 0n : (value + divisor - 1n) / divisor;
}

export function premiumAtLimit(quantityRaw: bigint, priceRaw: bigint, oneCollateral: bigint): bigint {
  return ceilDiv(quantityRaw * priceRaw, oneCollateral);
}

export function parseDecimal(value: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new TypeError(`invalid unsigned decimal: ${value}`);
  if (!Number.isSafeInteger(decimals) || decimals < 0) throw new RangeError("invalid decimals");
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new RangeError(`${value} has more than ${decimals} significant decimal places`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction.slice(0, decimals) + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function formatDecimal(value: bigint, decimals: number): string {
  if (value < 0n) return `-${formatDecimal(-value, decimals)}`;
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function asksFor(book: EventOrderBook, outcome: Outcome): readonly BookLevel[] {
  return outcome === "YES" ? book.yesAsks : book.noAsks;
}

export function executableDepth(
  book: EventOrderBook,
  outcome: Outcome,
  maximumOutcomePriceRaw: bigint,
  depthLevels = 20,
): { quantityRaw: bigint; premiumRaw: bigint; bestAskRaw?: bigint } {
  const levels = asksFor(book, outcome).slice(0, depthLevels);
  let quantityRaw = 0n;
  let premiumNumerator = 0n;
  for (const level of levels) {
    if (level.priceRaw > maximumOutcomePriceRaw) break;
    quantityRaw += level.quantityRaw;
    premiumNumerator += level.quantityRaw * level.priceRaw;
  }
  return {
    quantityRaw,
    premiumRaw: premiumNumerator,
    ...(levels[0] ? { bestAskRaw: levels[0].priceRaw } : {}),
  };
}

export function stableFingerprint(value: unknown): Hex {
  const normalize = (input: unknown): unknown => {
    if (typeof input === "bigint") return input.toString();
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return input;
  };
  return keccak256(toHex(JSON.stringify(normalize(value))));
}

export function buildPreparedIoc(args: {
  market: EventMarketSnapshot;
  book: EventOrderBook;
  params: BookParameters;
  outcome: Outcome;
  quantityRaw: bigint;
  maximumOutcomePriceRaw: bigint;
  premiumBudgetRaw: bigint;
  maximumBookMoveBps: bigint;
  expirySeconds: number;
  depthLevels?: number;
  nowMs: number;
}): PreparedIocOrder {
  const { market, params, outcome } = args;
  if (market.status !== 1) throw new Error(`market ${market.marketId} is not Trading on-chain`);
  if (args.maximumBookMoveBps < 0n || args.maximumBookMoveBps > 10_000n) throw new RangeError("invalid book-move tolerance");
  const one = 10n ** BigInt(market.collateralDecimals);
  const price = floorToStep(args.maximumOutcomePriceRaw, params.tickSize);
  const quantity = floorToStep(args.quantityRaw, params.lotSize);
  if (price <= 0n || price >= one) throw new RangeError("bounded price must be inside (0, 1)");
  if (quantity === 0n || quantity < params.minQuantity) throw new RangeError("normalized quantity is zero or below minimum");
  const maximumPremium = premiumAtLimit(quantity, price, one);
  if (maximumPremium > args.premiumBudgetRaw) throw new RangeError("normalized order exceeds premium budget");
  const depth = executableDepth(args.book, outcome, price, args.depthLevels);
  if (depth.bestAskRaw === undefined) throw new Error("no executable resting ask");
  if (quantity > depth.quantityRaw) throw new RangeError("normalized order exceeds executable visible depth");
  const nowSec = Math.floor(args.nowMs / 1_000);
  const expirySec = Math.min(nowSec + args.expirySeconds, market.expiry);
  if (expirySec <= nowSec) throw new Error("order expiry is not in the future");
  const yesPrice = outcome === "YES" ? price : one - price;
  const prepared = {
    chainId: 50_312,
    venueId: market.venueId,
    marketId: market.marketId,
    pool: market.pool,
    poolNonce: market.poolNonce,
    outcomeToken: market.outcomeToken,
    yesId: market.yesId,
    noId: market.noId,
    outcome,
    side: outcome === "YES" ? "BUY_YES" : "BUY_NO",
    yesPriceRaw: yesPrice,
    outcomePriceRaw: price,
    quantityRaw: quantity,
    maximumPremiumRaw: args.premiumBudgetRaw,
    estimatedPremiumRaw: maximumPremium,
    visibleExecutableQuantityRaw: depth.quantityRaw,
    expireTimestampNs: BigInt(expirySec) * 1_000_000_000n,
    observedBestAskRaw: depth.bestAskRaw,
    maximumBookMoveBps: args.maximumBookMoveBps,
    preparedAt: new Date(args.nowMs).toISOString(),
  } as const;
  return { ...prepared, authorizationFingerprint: stableFingerprint(prepared) };
}
