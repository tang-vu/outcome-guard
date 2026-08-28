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

export function authorizationMessage(input: {
  receiptDigest: string;
  receiptId: string;
  receiptCreatedAt: string;
  venueId: string;
  marketId: string;
  snapshotAt: string;
  marketExpiry: string;
  size: number;
  worstPrice: number;
  maximumPremium: number;
  collateralSymbol: string;
}): string {
  const deadline = new Date(Math.min(Date.parse(input.marketExpiry), Date.parse(input.receiptCreatedAt) + 120_000)).toISOString();
  return [
    "OutcomeGuard intent authorization v1",
    `Receipt: ${input.receiptDigest}`,
    `Authorization nonce: ${input.receiptId}`,
    `Authorization deadline: ${deadline}`,
    `Chain: ${SHANNON_CHAIN_ID}`,
    `Venue: ${input.venueId}`,
    `Market: ${input.marketId}`,
    `Snapshot: ${input.snapshotAt}`,
    `Market expiry: ${input.marketExpiry}`,
    "Order: BUY DOWN · IOC",
    `Size: ${input.size}`,
    `Worst price: ${input.worstPrice}`,
    `Maximum premium: ${input.maximumPremium} ${input.collateralSymbol}`,
    "This signature authorizes intent only. A fresh fail-closed policy pass is still required before any transaction signature."
  ].join("\n");
}
