import { createShannonAdapter, DREAMDEX_SHANNON_VENUE, formatDecimal } from "@outcome-guard/dreamdex";
import { getAddress } from "viem";

async function main(): Promise<void> {
  const account = getAddress(process.argv[2] ?? process.env.AGENT_SIGNER_ADDRESS ?? "0x1A3b41966bd8fFf0637685D5398762778FdeFfc2");
  const adapter = createShannonAdapter({ mode: "live", venueId: DREAMDEX_SHANNON_VENUE });
  const client = adapter.exchange?.client;
  if (!client) throw new Error("Shannon client is unavailable");

const rows = await client.listBinaryMarkets({ venueId: DREAMDEX_SHANNON_VENUE, status: "Finalized", limit: 200 });
const positions: unknown[] = [];

for (let offset = 0; offset < rows.length; offset += 10) {
  const batch = rows.slice(offset, offset + 10);
  const results = await Promise.all(batch.map(async (row) => {
    const market = await client.getMarketOnchain(row.marketId);
    const [yesRaw, noRaw] = await Promise.all([
      client.getOutcomeBalance({ outcomeToken: market.outcomeToken, account, id: market.yesId }),
      client.getOutcomeBalance({ outcomeToken: market.outcomeToken, account, id: market.noId }),
    ]);
    if (yesRaw === 0n && noRaw === 0n) return undefined;
    const winningOutcome = market.status === 5 ? "VOID" : market.winningOutcome === 0 ? "YES" : "NO";
    const winningRaw = winningOutcome === "YES" ? yesRaw : winningOutcome === "NO" ? noRaw : undefined;
    return {
      marketId: row.marketId,
      asset: row.asset,
      expiry: new Date(Number(market.expiry) * 1_000).toISOString(),
      status: market.status,
      finalized: market.finalized,
      winningOutcome,
      balances: { yes: formatDecimal(yesRaw, market.decimals), no: formatDecimal(noRaw, market.decimals) },
      claimableWinningTokens: winningRaw === undefined ? "requires-void-quote" : formatDecimal(winningRaw, market.decimals),
    };
  }));
  positions.push(...results.filter(Boolean));
}

  process.stdout.write(`${JSON.stringify({ account, scannedFinalizedMarkets: rows.length, ownedFinalizedPositions: positions.length, positions }, null, 2)}\n`);
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
