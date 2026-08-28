import { hedgeIntentSchema, type ExecutionMandate, type HedgeIntent } from "@outcome-guard/schemas";

export const SHANNON_CHAIN_ID = 50312 as const;
export const SHANNON_RPC_URL = "https://api.infra.testnet.somnia.network";
export const SHANNON_EXPLORER_URL = "https://shannon-explorer.somnia.network";
export const DREAMDEX_INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
export const DREAMDEX_VENUE_ID = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const;
export const MARKETS_SDK_VERSION = "0.28.1" as const;
export const TESTNET_COLLATERAL = {
  symbol: "tUSDC",
  address: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as const,
  decimals: 6
};

export function assertShannon(chainId: number): asserts chainId is typeof SHANNON_CHAIN_ID {
  if (chainId !== SHANNON_CHAIN_ID) throw new Error(`OutcomeGuard writes are Shannon-only; received chain ${chainId}.`);
}

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export function executionMandateMessage(mandate: ExecutionMandate, mandateDigest: string): string {
  return [
    "OutcomeGuard exact execution mandate v1",
    `Mandate digest: ${mandateDigest}`,
    `Receipt digest: ${mandate.receiptDigest}`,
    `Authorization nonce: ${mandate.receiptId}`,
    `Authorization deadline: ${mandate.authorizationDeadline}`,
    `Chain: ${mandate.chainId}`,
    `Venue: ${mandate.venueId}`,
    `Market: ${mandate.marketId}`,
    `Execution signer: ${mandate.executionSigner}`,
    `Market snapshot digest: ${mandate.marketSnapshotDigest}`,
    `Snapshot captured at: ${mandate.snapshotCapturedAt}`,
    "Order: BUY_NO IOC",
    `YES call price raw: ${mandate.yesPriceRaw}`,
    `NO outcome price raw: ${mandate.outcomePriceRaw}`,
    `Quantity raw: ${mandate.quantityRaw}`,
    `Maximum premium raw: ${mandate.maximumPremiumRaw}`,
    `Order expiry ns: ${mandate.orderExpiryNs}`,
    "Auto redeem: false",
    "The worker must re-run fail-closed policy checks from fresh chain data before signing a transaction."
  ].join("\n");
}

export type IntentParserProvider = {
  id: string;
  parse(text: string): Promise<unknown>;
};

export type ParsedIntent = {
  intent: HedgeIntent;
  source: "provider" | "local-fallback";
  providerId: string;
  extractedFields: (keyof HedgeIntent)[];
  warnings: string[];
};

const numberFrom = (text: string, pattern: RegExp): number | undefined => {
  const value = text.match(pattern)?.[1];
  if (!value) return undefined;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseIntentLocally(text: string, fallback: HedgeIntent): ParsedIntent {
  if (text.length > 1_000 || text.includes("\0")) throw new Error("Intent text is invalid or exceeds 1,000 characters.");
  const candidate: HedgeIntent = { ...fallback };
  const extractedFields: (keyof HedgeIntent)[] = [];
  const set = <K extends keyof HedgeIntent>(key: K, value: HedgeIntent[K] | undefined) => {
    if (value !== undefined) { candidate[key] = value; extractedFields.push(key); }
  };
  const upper = text.toUpperCase();
  set("asset", /\b(?:ETH|ETHEREUM)\b/.test(upper) ? "ETH" : /\b(?:BTC|BITCOIN)\b/.test(upper) ? "BTC" : undefined);
  set("exposureUsd", numberFrom(text, /(?:protect(?:\s+my)?|hedge)\s+\$?([\d,.]+)\s*(?:USD)?\s*(?:ETH|BTC|Ethereum|Bitcoin)?\s*exposure/i));
  const horizonPrefix = "(?:for\\s+(?:the\\s+)?next|for|next)";
  set("horizonMinutes", new RegExp(`${horizonPrefix}\\s+(?:(?:1|one)\\s*)?(?:hour|hr)\\b`, "i").test(text) ? 60 : new RegExp(`${horizonPrefix}\\s+15\\s*(?:minutes?|mins?)\\b`, "i").test(text) ? 15 : undefined);
  set("maxPremium", numberFrom(text, /(?:spend\s+no\s+more\s+than|maximum\s+premium|max\s+premium|premium\s+cap)\s+\$?([\d,.]+)/i));
  set("maxSlippagePct", numberFrom(text, /([\d.]+)\s*%\s*(?:maximum\s+|max\s+)?slippage/i));
  set("adverseMovePct", numberFrom(text, /([\d.]+)\s*%\s*(?:downside|adverse|drop|decline)/i));
  set("targetProtectionPct", numberFrom(text, /([\d.]+)\s*%\s*(?:target\s+)?protection/i));
  const intent = hedgeIntentSchema.parse(candidate);
  const warnings = extractedFields.length === 0 ? ["No supported values were found; structured controls were left unchanged."] : [];
  return { intent, source: "local-fallback", providerId: "deterministic-local-v1", extractedFields, warnings };
}

export async function parseIntent(text: string, fallback: HedgeIntent, provider?: IntentParserProvider): Promise<ParsedIntent> {
  if (!provider) return parseIntentLocally(text, fallback);
  try {
    const intent = hedgeIntentSchema.parse(await provider.parse(text));
    return { intent, source: "provider", providerId: provider.id, extractedFields: Object.keys(intent) as (keyof HedgeIntent)[], warnings: [] };
  } catch {
    const local = parseIntentLocally(text, fallback);
    return { ...local, warnings: [...local.warnings, `Provider ${provider.id} failed schema validation; deterministic fallback was used.`] };
  }
}
