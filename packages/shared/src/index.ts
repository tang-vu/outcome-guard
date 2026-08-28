import type { ExecutionMandate } from "@outcome-guard/schemas";

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
