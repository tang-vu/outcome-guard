import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyReceipt } from "@outcome-guard/receipt";
import { receiptCoreSchema } from "@outcome-guard/schemas";

export async function GET() {
  const evidenceRoot = resolve(process.cwd(), "..", "..", "docs", "evidence", "redemption-campaign-eec6");
  const [execution, settlement, redemption] = await Promise.all([
    readFile(resolve(evidenceRoot, "execution-receipt.json"), "utf8").then((value) => receiptCoreSchema.parse(JSON.parse(value))),
    readFile(resolve(evidenceRoot, "settlement-receipt.json"), "utf8").then((value) => receiptCoreSchema.parse(JSON.parse(value))),
    readFile(resolve(evidenceRoot, "redemption-receipt.json"), "utf8").then((value) => receiptCoreSchema.parse(JSON.parse(value))),
  ]);
  const linked = settlement.integrity.previousReceiptDigest?.toLowerCase() === execution.integrity.digest.toLowerCase() && redemption.integrity.previousReceiptDigest?.toLowerCase() === settlement.integrity.digest.toLowerCase();
  if (!verifyReceipt(execution).valid || !verifyReceipt(settlement).valid || !verifyReceipt(redemption).valid || !linked || redemption.lifecycleStage !== "REDEMPTION") return Response.json({ error: "Owned lifecycle receipt verification failed" }, { status: 500 });
  return Response.json({
    label: "VERIFIED_OWNED_LIFECYCLE",
    market: { marketId: settlement.marketSnapshot.marketId, asset: settlement.marketSnapshot.asset, intervalSec: settlement.marketSnapshot.intervalSec, question: settlement.marketSnapshot.settlementReference },
    execution: { txHash: execution.execution.txHash, explorerUrl: execution.execution.explorerUrl, filledSize: execution.execution.filledSize, filledOutcome: execution.execution.position?.filledOutcome, receiptDigest: execution.integrity.digest },
    terminalState: { status: settlement.settlement?.marketStatus, winningOutcome: settlement.settlement?.outcome, claimable: settlement.settlement?.claimable },
    position: { amount: settlement.execution.position?.positionDelta, outcome: settlement.execution.position?.filledOutcome },
    settlementReceiptDigest: settlement.integrity.digest,
    redemption: { txHash: redemption.redemption?.txHash, explorerUrl: redemption.redemption?.explorerUrl, amount: redemption.redemption?.amount, positionAfter: "0", receiptDigest: redemption.integrity.digest },
    verification: { valid: true, linked },
  }, { headers: { "cache-control": "public, max-age=300, immutable" } });
}
