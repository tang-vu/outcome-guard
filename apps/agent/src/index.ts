import { createServer } from "node:http";
import { createShannonAdapter, DREAMDEX_SHANNON_VENUE, formatDecimal, type DreamDexAdapter } from "@outcome-guard/dreamdex";
import { z } from "zod";

const envSchema = z.object({
  NETWORK: z.literal("testnet").default("testnet"),
  CHAIN_ID: z.coerce.number().int().default(50312).refine((value) => value === 50312, "must be Shannon chain 50312"),
  DRY_RUN: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  FIXTURE_MODE: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  VENUE_ID: z.string().regex(/^0x[0-9a-fA-F]{64}$/).default(DREAMDEX_SHANNON_VENUE),
  RPC_URL: z.string().url().default("https://api.infra.testnet.somnia.network"),
  WS_RPC_URL: z.string().url().default("wss://api.infra.testnet.somnia.network/ws"),
  INDEXER_URL: z.string().url().default("https://dev.smk.somnia.host/v1/graphql"),
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000)
});

const config = envSchema.parse(process.env);
if (!config.DRY_RUN && !config.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required only when DRY_RUN=false");

type Health = { status: "starting" | "healthy" | "degraded" | "stopping"; mode: "fixture" | "live"; dryRun: boolean; chainId: 50312; venueId: string; lastCycleAt?: string; marketsSeen: number; lastError?: string };
const health: Health = { status: "starting", mode: config.FIXTURE_MODE ? "fixture" : "live", dryRun: config.DRY_RUN, chainId: 50312, venueId: config.VENUE_ID, marketsSeen: 0 };
const log = (level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, service: "outcome-guard-agent", event, ...fields }));

let adapter: DreamDexAdapter;
let timer: NodeJS.Timeout | undefined;
let stopping = false;
let cycleTail = Promise.resolve();

async function cycle(): Promise<void> {
  if (stopping) return;
  try {
    const markets = await adapter.discoverMarkets({ minimumSecondsLeft: 30, limit: 20 });
    health.status = "healthy"; health.lastCycleAt = new Date().toISOString(); health.marketsSeen = markets.length; delete health.lastError;
    for (const market of markets) {
      const [book, params] = await Promise.all([adapter.getBook(market, 5), adapter.getBookParameters(market)]);
      log("info", "market.snapshot", {
        marketId: market.marketId, asset: market.asset, intervalSec: market.intervalSec, status: market.statusName,
        expiry: new Date(market.expiry * 1000).toISOString(), yesBestBid: book.yesBids[0] ? formatDecimal(book.yesBids[0].priceRaw, market.collateralDecimals) : null,
        yesBestAsk: book.yesAsks[0] ? formatDecimal(book.yesAsks[0].priceRaw, market.collateralDecimals) : null,
        tickRaw: params.tickSize.toString(), lotRaw: params.lotSize.toString(), minQuantityRaw: params.minQuantity.toString(), action: "observe"
      });
    }
    if (markets.length === 0) log("warn", "market.none", { reason: "No eligible DreamDEX markets in explicit venue scope; no write attempted." });
  } catch (error) {
    health.status = "degraded"; health.lastCycleAt = new Date().toISOString(); health.lastError = error instanceof Error ? error.message : String(error);
    log("error", "cycle.failed", { error: health.lastError, retry: "next serialized cycle" });
  }
}

function schedule(): void {
  timer = setInterval(() => { cycleTail = cycleTail.then(cycle, cycle); }, config.POLL_INTERVAL_MS);
}

const server = createServer((request, response) => {
  if (request.url === "/health") { response.writeHead(health.status === "healthy" ? 200 : 503, { "content-type": "application/json" }); response.end(JSON.stringify(health)); return; }
  response.writeHead(404, { "content-type": "application/json" }); response.end(JSON.stringify({ error: "not_found" }));
});

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true; health.status = "stopping"; if (timer) clearInterval(timer);
  log("info", "shutdown.started", { signal });
  await cycleTail.catch(() => undefined);
  await Promise.race([adapter.close(), new Promise<void>((resolve) => setTimeout(resolve, 3_000))]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  log("info", "shutdown.complete");
}

async function main(): Promise<void> {
  adapter = createShannonAdapter({
    mode: config.FIXTURE_MODE ? "fixture" : "live", venueId: config.VENUE_ID as `0x${string}`,
    rpcUrl: config.RPC_URL, wsRpcUrl: config.WS_RPC_URL, indexerUrl: config.INDEXER_URL,
    ...(config.DRY_RUN || !config.PRIVATE_KEY ? {} : { privateKey: config.PRIVATE_KEY as `0x${string}` })
  });
  server.listen(config.PORT, "0.0.0.0", () => log("info", "startup", { port: config.PORT, chainId: 50312, venueId: config.VENUE_ID, mode: health.mode, dryRun: health.dryRun, signerLoaded: Boolean(config.PRIVATE_KEY) }));
  await cycle(); schedule();
}

process.on("SIGINT", () => void shutdown("SIGINT").then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown("SIGTERM").then(() => process.exit(0)));
process.on("unhandledRejection", (error) => log("error", "unhandledRejection", { error: String(error) }));
void main().catch((error) => { log("error", "startup.failed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
