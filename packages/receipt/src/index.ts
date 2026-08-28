import { createHash, randomUUID } from "node:crypto";
import { recoverMessageAddress } from "viem";
import type { ExecutionBundle, ExecutionMandate, OutcomeGuardReceipt } from "@outcome-guard/schemas";
import { executionBundleSchema, receiptCoreSchema } from "@outcome-guard/schemas";
import { executionMandateMessage } from "@outcome-guard/shared";

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

export function computeMarketSnapshotDigest(snapshot: OutcomeGuardReceipt["marketSnapshot"]): `0x${string}` {
  return sha256(canonicalize(snapshot as unknown as Json));
}

export function computeMandateDigest(mandate: ExecutionMandate): `0x${string}` {
  return sha256(canonicalize(mandate as unknown as Json));
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

function decimalToRaw(value: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`invalid decimal ${value}`);
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) throw new Error(`${value} exceeds collateral precision`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction.slice(0, decimals) + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export async function verifyExecutionBundle(value: unknown, options: { nowMs?: number; executionSigner?: string } = {}): Promise<VerificationResult & { bundle?: ExecutionBundle }> {
  const parsed = executionBundleSchema.safeParse(value);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  const chain = verifyReceiptChain([parsed.data.preExecutionReceipt, parsed.data.authorizedReceipt]);
  if (!chain.valid) return chain;
  const { preExecutionReceipt: pre, authorizedReceipt: authorized, mandate } = parsed.data;
  if (!authorized.authorization.approvedAt || !authorized.authorization.signedPayloadHash || !authorized.authorization.mandateDigest) {
    return { valid: false, errors: ["Authorized receipt is missing approval or signed-payload evidence."] };
  }
  try {
    const referenceMs = options.nowMs ?? Date.parse(authorized.authorization.approvedAt);
    const marketDigest = computeMarketSnapshotDigest(pre.marketSnapshot);
    if (marketDigest.toLowerCase() !== mandate.marketSnapshotDigest.toLowerCase()) throw new Error("Market snapshot digest does not reproduce");
    if (mandate.snapshotCapturedAt !== pre.marketSnapshot.capturedAt) throw new Error("Mandate snapshot time does not match the receipt");
    if (Date.parse(mandate.snapshotCapturedAt) > referenceMs) throw new Error("Mandate snapshot is in the future");
    if (mandate.chainId !== pre.network.chainId || mandate.venueId.toLowerCase() !== pre.marketSnapshot.venueId.toLowerCase() || mandate.marketId.toLowerCase() !== pre.marketSnapshot.marketId.toLowerCase()) throw new Error("Mandate network, venue, or market does not match the receipt");
    if (options.executionSigner && mandate.executionSigner.toLowerCase() !== options.executionSigner.toLowerCase()) throw new Error("Mandate targets a different execution signer");

    const decimals = pre.marketSnapshot.collateral.decimals;
    const scale = 10n ** BigInt(decimals);
    const outcomePrice = BigInt(mandate.outcomePriceRaw);
    const yesPrice = BigInt(mandate.yesPriceRaw);
    const quantity = BigInt(mandate.quantityRaw);
    const maximumPremium = BigInt(mandate.maximumPremiumRaw);
    if (outcomePrice <= 0n || outcomePrice >= scale || yesPrice !== scale - outcomePrice) throw new Error("Mandate outcome and YES call prices are inconsistent");
    const tick = decimalToRaw(pre.marketSnapshot.bookParams.tickSize, decimals);
    const lot = decimalToRaw(pre.marketSnapshot.bookParams.lotSize, decimals);
    const minimum = decimalToRaw(pre.marketSnapshot.bookParams.minQuantity, decimals);
    if (tick <= 0n || yesPrice % tick !== 0n || outcomePrice % tick !== 0n) throw new Error("Mandate price is off the sealed tick grid");
    if (lot <= 0n || quantity < minimum || quantity % lot !== 0n) throw new Error("Mandate quantity is off the sealed lot grid or below minimum");
    const premiumAtLimit = (quantity * outcomePrice + scale - 1n) / scale;
    if (premiumAtLimit > maximumPremium) throw new Error("Mandate premium arithmetic exceeds the raw authorization");
    const userMaximumPremium = decimalToRaw(pre.intent.normalized.maxPremium.toString(), decimals);
    if (maximumPremium > userMaximumPremium) throw new Error("Mandate maximum premium exceeds the user's sealed budget");

    const exactDeadline = new Date(Math.min(Date.parse(pre.marketSnapshot.expiry), Date.parse(pre.createdAt) + 120_000)).toISOString();
    if (mandate.authorizationDeadline !== exactDeadline) throw new Error("Mandate authorization deadline does not reproduce");
    const nowNs = BigInt(referenceMs) * 1_000_000n;
    const deadlineNs = BigInt(Date.parse(mandate.authorizationDeadline)) * 1_000_000n;
    const marketExpiryNs = BigInt(Date.parse(pre.marketSnapshot.expiry)) * 1_000_000n;
    const orderExpiryNs = BigInt(mandate.orderExpiryNs);
    if (nowNs >= deadlineNs || orderExpiryNs <= nowNs || orderExpiryNs > deadlineNs || orderExpiryNs > marketExpiryNs) throw new Error("Mandate or order expiry is outside the authorized time window");

    const mandateDigest = computeMandateDigest(mandate);
    if (authorized.authorization.mandateDigest.toLowerCase() !== mandateDigest.toLowerCase()) throw new Error("Authorized receipt mandate digest does not reproduce");
    const expectedMessage = executionMandateMessage(mandate, mandateDigest);
    if (parsed.data.message !== expectedMessage) throw new Error("Signed message does not reproduce from the exact mandate");
    if (authorized.authorization.signedPayloadHash.toLowerCase() !== sha256(expectedMessage).toLowerCase()) throw new Error("Signed payload hash does not reproduce");
    const recovered = await recoverMessageAddress({ message: expectedMessage, signature: parsed.data.signature as `0x${string}` });
    if (recovered.toLowerCase() !== parsed.data.signer.toLowerCase() || recovered.toLowerCase() !== authorized.authorization.signer.toLowerCase()) throw new Error("EIP-191 signature does not match the recorded human authorizer");
    return { valid: true, errors: [], bundle: parsed.data };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}
