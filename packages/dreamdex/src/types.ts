import type { Address, Hash, Hex, WalletClient } from "viem";

export const SHANNON_CHAIN_ID = 50_312 as const;
export const SHANNON_EXPLORER = "https://shannon-explorer.somnia.network" as const;
export const DREAMDEX_SHANNON_VENUE =
  "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const;

export type Outcome = "YES" | "NO";
export type SupportedAsset = "BTC" | "ETH";
export type AdapterMode = "fixture" | "live";

export interface DreamDexAdapterConfig {
  mode: AdapterMode;
  chainId?: number;
  venueId?: Hex;
  rpcUrl?: string;
  wsRpcUrl?: string;
  indexerUrl?: string;
  privateKey?: Hex;
  walletClient?: WalletClient;
  now?: () => number;
  fixture?: FixtureDocument;
  /** Mandatory for live writes. The coordinator must verify the human signature and shared policy bundle. */
  executionGuard?: (order: PreparedIocOrder) => Promise<ExecutionAuthorization>;
}

export interface ExecutionAuthorization {
  orderFingerprint: Hex;
  receiptDigest: Hex;
  verifiedHumanSignature: boolean;
  policyStatuses: readonly ("PASS" | "WARN" | "FAIL")[];
  authorizedChainId: typeof SHANNON_CHAIN_ID;
  expiresAtMs: number;
}

export interface MarketDiscoveryFilter {
  asset?: SupportedAsset;
  intervalSec?: number;
  minimumSecondsLeft?: number;
  limit?: number;
}

export interface BookLevel {
  priceRaw: bigint;
  quantityRaw: bigint;
}

export interface EventOrderBook {
  marketId: Hex;
  capturedAt: string;
  blockNumber?: bigint;
  yesBids: readonly BookLevel[];
  yesAsks: readonly BookLevel[];
  noBids: readonly BookLevel[];
  noAsks: readonly BookLevel[];
}

export interface BookParameters {
  tickSize: bigint;
  lotSize: bigint;
  minQuantity: bigint;
}

export interface EventMarketSnapshot {
  marketId: Hex;
  marketAddress: Address;
  pool: Address;
  poolNonce: bigint;
  outcomeToken: Address;
  yesId: bigint;
  noId: bigint;
  collateral: Address;
  collateralDecimals: number;
  asset: SupportedAsset;
  intervalSec: number;
  tradingStart: number;
  expiry: number;
  venueId: Hex;
  operatorId?: number;
  status: number;
  statusName: "Listed" | "Trading" | "Locked" | "Settling" | "Resolved" | "Voided" | "Unknown";
  question: string;
  oracleQuestion?: string;
  oracleQuestionId?: string;
  strikeRaw: string;
  fetchedAt: string;
  source: "shannon-chain+indexer" | "deterministic-fixture";
}

export interface BoundedIocRequest {
  market: EventMarketSnapshot;
  outcome: Outcome;
  quantityRaw: bigint;
  maximumOutcomePriceRaw: bigint;
  premiumBudgetRaw: bigint;
  maximumBookMoveBps: bigint;
  expirySeconds: number;
  visibleDepthLevels?: number;
}

export interface PreparedIocOrder {
  chainId: typeof SHANNON_CHAIN_ID;
  venueId: Hex;
  marketId: Hex;
  pool: Address;
  poolNonce: bigint;
  outcomeToken: Address;
  yesId: bigint;
  noId: bigint;
  outcome: Outcome;
  side: "BUY_YES" | "BUY_NO";
  yesPriceRaw: bigint;
  outcomePriceRaw: bigint;
  quantityRaw: bigint;
  maximumPremiumRaw: bigint;
  estimatedPremiumRaw: bigint;
  visibleExecutableQuantityRaw: bigint;
  expireTimestampNs: bigint;
  observedBestAskRaw: bigint;
  maximumBookMoveBps: bigint;
  authorizationFingerprint: Hex;
  preparedAt: string;
}

export interface ConfirmedIocExecution {
  status: "confirmed";
  txHash: Hash;
  blockNumber: bigint;
  explorerUrl: string;
  requestedQuantityRaw: bigint;
  filledQuantityRaw: bigint;
  averageOutcomePriceRaw?: bigint;
  premiumPaidRaw: bigint;
  positionBefore: OutcomePosition;
  positionAfter: OutcomePosition;
  positionDeltaRaw: bigint;
  collateralSpentRaw: bigint;
  position: OutcomePosition;
}

export interface OutcomePosition {
  account: Address;
  marketId: Hex;
  yesRaw: bigint;
  noRaw: bigint;
  readAt: string;
}

export interface FinalizedMarket {
  marketId: Hex;
  venueId: Hex;
  asset: string;
  intervalSec: number;
  expiry: number;
  winningOutcome: 0 | 1 | null;
  voided: boolean;
}

export interface ConfirmedRedemption {
  status: "confirmed";
  marketId: Hex;
  outcome: Outcome;
  amountRaw: bigint;
  txHash: Hash;
  blockNumber: bigint;
  explorerUrl: string;
}

export interface FixtureDocument {
  schemaVersion: "outcomeguard.dreamdex-fixture.v1";
  chainId: typeof SHANNON_CHAIN_ID;
  venueId: Hex;
  capturedAt: string;
  markets: readonly EventMarketSnapshot[];
  books: Readonly<Record<string, EventOrderBook>>;
  bookParameters: Readonly<Record<string, BookParameters>>;
}
