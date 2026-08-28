import { createHash, randomUUID } from "node:crypto";
import type { OutcomeGuardReceipt } from "@outcome-guard/schemas";
import { receiptCoreSchema } from "@outcome-guard/schemas";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** RFC 8785 JSON Canonicalization Scheme for the JSON-compatible receipt domain. */
export function canonicalize(value: Json): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers cannot be canonicalized");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key]!)}`).join(",")}}`;
}

export function sha256(value: string): `0x${string}` {
  return `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function digestPayload(receipt: OutcomeGuardReceipt): Json {
  const { digest: omittedDigest, ...integrity } = receipt.integrity;
  void omittedDigest;
  return { ...receipt, integrity } as unknown as Json;
}

export function computeReceiptDigest(receipt: OutcomeGuardReceipt): `0x${string}` {
  return sha256(canonicalize(digestPayload(receipt)));
}

export function sealReceipt(input: Omit<OutcomeGuardReceipt, "receiptId" | "integrity"> & { receiptId?: string; previousReceiptDigest?: string }): OutcomeGuardReceipt {
  const { previousReceiptDigest, ...body } = input;
  const draft = {
    ...body,
    receiptId: input.receiptId ?? randomUUID(),
    integrity: {
      canonicalization: "RFC8785-JCS" as const,
      digestAlgorithm: "sha256" as const,
      digest: "0x00",
      ...(previousReceiptDigest ? { previousReceiptDigest } : {})
    }
  } as OutcomeGuardReceipt;
  draft.integrity.digest = computeReceiptDigest(draft);
  return receiptCoreSchema.parse(draft);
}

export type VerificationResult = { valid: boolean; claimedDigest?: string; computedDigest?: string; errors: string[] };

export function verifyReceipt(value: unknown): VerificationResult {
  const parsed = receiptCoreSchema.safeParse(value);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  const computedDigest = computeReceiptDigest(parsed.data);
  const valid = computedDigest.toLowerCase() === parsed.data.integrity.digest.toLowerCase();
  return { valid, claimedDigest: parsed.data.integrity.digest, computedDigest, errors: valid ? [] : ["Receipt digest mismatch: content was changed or the digest is invalid."] };
}

export function verifyReceiptChain(receipts: OutcomeGuardReceipt[]): VerificationResult {
  const stages = { PRE_EXECUTION: 0, EXECUTION: 1, SETTLEMENT: 2, REDEMPTION: 3 } as const;
  if (receipts[0]?.integrity.previousReceiptDigest) return { valid: false, errors: ["First receipt must not claim a predecessor."] };
  for (let index = 0; index < receipts.length; index++) {
    const current = receipts[index]!;
    const check = verifyReceipt(current);
    if (!check.valid) return check;
    if (index > 0 && current.integrity.previousReceiptDigest !== receipts[index - 1]!.integrity.digest) {
      return {
        valid: false,
        ...(current.integrity.previousReceiptDigest ? { claimedDigest: current.integrity.previousReceiptDigest } : {}),
        computedDigest: receipts[index - 1]!.integrity.digest,
        errors: [`Receipt ${index} does not link to receipt ${index - 1}.`]
      };
    }
    if (index > 0) {
      const previous = receipts[index - 1]!;
      if (stages[current.lifecycleStage] < stages[previous.lifecycleStage]) return { valid: false, errors: [`Receipt ${index} regresses lifecycle stage.`] };
      if (current.intent.intentHash !== previous.intent.intentHash || current.marketSnapshot.marketId.toLowerCase() !== previous.marketSnapshot.marketId.toLowerCase() || current.network.chainId !== previous.network.chainId) return { valid: false, errors: [`Receipt ${index} changes the intent, market, or network identity.`] };
      if (Date.parse(current.createdAt) < Date.parse(previous.createdAt)) return { valid: false, errors: [`Receipt ${index} predates its predecessor.`] };
    }
  }
  return { valid: true, errors: [] };
}
