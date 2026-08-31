import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { receiptCoreSchema, type OutcomeGuardReceipt } from "@outcome-guard/schemas";
import preExecutionReceipt from "../../../docs/evidence/pre-execution-receipt.json";

const preExecution = receiptCoreSchema.parse(preExecutionReceipt);

export async function findPublishedReceipt(digest: string): Promise<OutcomeGuardReceipt | undefined> {
  if (preExecution.integrity.digest.toLowerCase() === digest.toLowerCase()) return preExecution;
  // Runtime JSON.parse preserves the exact canonical numeric representation.
  // Bundling the evidence as a JS object changed one high-precision scenario
  // number under Turbopack and correctly tripped receipt verification.
  const path = resolve(process.cwd(), "..", "..", "docs", "evidence", "execution-receipt.json");
  const execution = receiptCoreSchema.parse(JSON.parse(await readFile(path, "utf8")));
  return execution.integrity.digest.toLowerCase() === digest.toLowerCase() ? execution : undefined;
}
