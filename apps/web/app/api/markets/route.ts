import { createShannonAdapter, DREAMDEX_SHANNON_VENUE } from "@outcome-guard/dreamdex";

export const dynamic = "force-dynamic";

export async function GET() {
  const adapter = createShannonAdapter({
    mode: "live", venueId: (process.env.VENUE_ID ?? DREAMDEX_SHANNON_VENUE) as `0x${string}`,
    rpcUrl: process.env.RPC_URL ?? "https://api.infra.testnet.somnia.network",
    wsRpcUrl: process.env.WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws",
    indexerUrl: process.env.INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql"
  });
  try {
    const markets = await adapter.discoverMarkets({ minimumSecondsLeft: 30, limit: 12 });
    const snapshots = await Promise.all(markets.map(async (market) => {
      const [book, parameters] = await Promise.all([adapter.getBook(market, 5), adapter.getBookParameters(market)]);
      return { market, book, parameters };
    }));
    return Response.json(JSON.parse(JSON.stringify({ source: "live", capturedAt: new Date().toISOString(), sdkVersion: "0.28.1", chainId: 50312, venueId: process.env.VENUE_ID ?? DREAMDEX_SHANNON_VENUE, snapshots }, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value)), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ source: "unavailable", error: error instanceof Error ? error.message : String(error), fallback: "/api/plan remains an explicitly labeled deterministic preview" }, { status: 503 });
  } finally {
    await Promise.race([adapter.close(), new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  }
}
