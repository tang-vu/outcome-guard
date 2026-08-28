import type { FixtureDocument } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000001" as const;
const MARKET_ID = `0x${"01".repeat(32)}` as const;
const VENUE_ID = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const;

export const deterministicFixture: FixtureDocument = {
  schemaVersion: "outcomeguard.dreamdex-fixture.v1",
  chainId: 50_312,
  venueId: VENUE_ID,
  capturedAt: "2026-08-28T00:00:00.000Z",
  markets: [
    {
      marketId: MARKET_ID,
      marketAddress: ZERO_ADDRESS,
      pool: "0x0000000000000000000000000000000000000002",
      poolNonce: 1n,
      outcomeToken: "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9",
      yesId: 2n,
      noId: 3n,
      collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
      collateralDecimals: 6,
      asset: "ETH",
      intervalSec: 3_600,
      tradingStart: 1_788_000_000,
      expiry: 4_102_444_800,
      venueId: VENUE_ID,
      operatorId: 2,
      status: 1,
      statusName: "Trading",
      question: "Will ETH close at or above its opening reference?",
      oracleQuestion: "ETH window comparison",
      oracleQuestionId: "1",
      strikeRaw: "0",
      fetchedAt: "2026-08-28T00:00:00.000Z",
      source: "deterministic-fixture",
    },
  ],
  books: {
    [MARKET_ID]: {
      marketId: MARKET_ID,
      capturedAt: "2026-08-28T00:00:00.000Z",
      yesBids: [{ priceRaw: 520_000n, quantityRaw: 50_000_000n }],
      yesAsks: [{ priceRaw: 540_000n, quantityRaw: 50_000_000n }],
      noBids: [{ priceRaw: 460_000n, quantityRaw: 50_000_000n }],
      noAsks: [{ priceRaw: 480_000n, quantityRaw: 50_000_000n }],
    },
  },
  bookParameters: {
    [MARKET_ID]: { tickSize: 1_000n, lotSize: 1n, minQuantity: 1n },
  },
};
