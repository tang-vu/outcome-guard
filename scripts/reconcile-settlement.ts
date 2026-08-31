import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createShannonAdapter, DREAMDEX_SHANNON_VENUE, formatDecimal } from "@outcome-guard/dreamdex";
import { sealReceipt, verifyReceipt } from "@outcome-guard/receipt";
import { receiptCoreSchema } from "@outcome-guard/schemas";

const STATUS_NAMES = ["Listed", "Trading", "Locked", "Settling", "Resolved", "Voided"] as const;
const DEFAULT_EXECUTION_RECEIPT = "docs/evidence/execution-receipt.json";
const DEFAULT_STATUS_EVIDENCE = "docs/evidence/settlement-status.json";
const DEFAULT_SETTLEMENT_RECEIPT = "docs/evidence/settlement-receipt.json";
const RPC_URL = "https://api.infra.testnet.somnia.network";
const EXPLORER_URL = "https://shannon-explorer.somnia.network";

function asJson(value: unknown): string {
  return `${JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2)}\n`;
}

async function main(): Promise<void> {
  const executionPath = resolve(process.argv[2] ?? DEFAULT_EXECUTION_RECEIPT);
  const statusPath = resolve(process.argv[3] ?? DEFAULT_STATUS_EVIDENCE);
  const settlementPath = resolve(process.argv[4] ?? DEFAULT_SETTLEMENT_RECEIPT);
  const execution = receiptCoreSchema.parse(JSON.parse(await readFile(executionPath, "utf8")));
  if (execution.lifecycleStage !== "EXECUTION" || execution.execution.status !== "RECONCILED" || !execution.execution.position) {
    throw new Error("settlement reconciliation requires a reconciled execution receipt with position evidence");
  }

  const adapter = createShannonAdapter({ mode: "live", venueId: DREAMDEX_SHANNON_VENUE });
  const client = adapter.exchange?.client;
  if (!client) throw new Error("Shannon client is unavailable");
  const marketId = execution.marketSnapshot.marketId as `0x${string}`;
  const account = execution.execution.position.account as `0x${string}`;
  const onchain = await client.getMarketOnchain(marketId);
  const [blockNumber, yesRaw, noRaw] = await Promise.all([
    client.getViemClient().getBlockNumber(),
    client.getOutcomeBalance({ outcomeToken: onchain.outcomeToken, account, id: onchain.yesId }),
    client.getOutcomeBalance({ outcomeToken: onchain.outcomeToken, account, id: onchain.noId }),
  ]);
  const statusName = STATUS_NAMES[onchain.status] ?? "Unknown";
  const terminal = onchain.status === 4 || onchain.status === 5;
  const outcome = onchain.status === 5 ? "VOID" : onchain.winningOutcome === 0 ? "UP" : "DOWN";
  const winningRaw = outcome === "UP" ? yesRaw : outcome === "DOWN" ? noRaw : undefined;
  const claimable = winningRaw === undefined ? undefined : formatDecimal(winningRaw, onchain.decimals);
  const capturedAt = new Date().toISOString();
  const statusEvidence = {
    schemaVersion: "outcomeguard.settlement-status.v1",
    capturedAt,
    network: { name: "somnia-shannon", chainId: 50312, rpcUrl: RPC_URL },
    marketId,
    account,
    blockNumber: blockNumber.toString(),
    status: { code: onchain.status, name: statusName, terminal, finalized: onchain.finalized, isResolved: onchain.isResolved, isVoided: onchain.isVoided },
    outcome: terminal ? outcome : null,
    position: { yes: formatDecimal(yesRaw, onchain.decimals), no: formatDecimal(noRaw, onchain.decimals) },
    claimable: terminal ? claimable ?? null : null,
    executionReceiptDigest: execution.integrity.digest,
  };
  await writeFile(statusPath, asJson(statusEvidence), "utf8");

  if (!terminal) {
    process.stdout.write(asJson({ ...statusEvidence, settlementReceipt: null }));
    return;
  }

  const { integrity: _integrity, receiptId: _receiptId, ...body } = execution;
  void _integrity;
  void _receiptId;
  const settlement = sealReceipt({
    ...body,
    createdAt: capturedAt,
    lifecycleStage: "SETTLEMENT",
    settlement: {
      marketStatus: `${statusName} · on-chain code ${onchain.status}`,
      outcome,
      ...(claimable !== undefined ? { claimable } : {}),
      settlementEvidence: [
        `Direct Shannon RPC getMarketOnchain at block ${blockNumber.toString()}`,
        `${EXPLORER_URL}/block/${blockNumber.toString()}`,
        `Outcome-token balances read for ${account}: YES ${formatDecimal(yesRaw, onchain.decimals)}, NO ${formatDecimal(noRaw, onchain.decimals)}`,
      ],
    },
    previousReceiptDigest: execution.integrity.digest,
  });
  const verification = verifyReceipt(settlement);
  if (!verification.valid) throw new Error(`sealed settlement receipt failed verification: ${verification.errors.join("; ")}`);
  await writeFile(settlementPath, asJson(settlement), "utf8");
  process.stdout.write(asJson({ ...statusEvidence, settlementReceipt: settlementPath, settlementReceiptDigest: settlement.integrity.digest, verified: true }));
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
