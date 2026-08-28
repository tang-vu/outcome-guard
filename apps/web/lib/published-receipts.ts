import { receiptCoreSchema, type OutcomeGuardReceipt } from "@outcome-guard/schemas";
import preExecutionReceipt from "../../../docs/evidence/pre-execution-receipt.json";

const publishedReceipts = [receiptCoreSchema.parse(preExecutionReceipt)] satisfies OutcomeGuardReceipt[];

export function findPublishedReceipt(digest: string): OutcomeGuardReceipt | undefined {
  return publishedReceipts.find((receipt) => receipt.integrity.digest.toLowerCase() === digest.toLowerCase());
}

export function listPublishedReceiptDigests(): string[] {
  return publishedReceipts.map((receipt) => receipt.integrity.digest);
}
