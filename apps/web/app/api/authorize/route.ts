import { recoverMessageAddress } from "viem";
import { sealReceipt, sha256, verifyReceipt } from "@outcome-guard/receipt";
import { executionBundleSchema, receiptCoreSchema } from "@outcome-guard/schemas";
import { authorizationMessage } from "@outcome-guard/shared";
import { z } from "zod";

const requestSchema = z.object({
  receipt: receiptCoreSchema,
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  signer: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
}).strict();

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const receiptVerification = verifyReceipt(body.receipt);
    if (!receiptVerification.valid) throw new Error(`Pre-execution receipt verification failed: ${receiptVerification.errors.join("; ")}`);
    const expected = authorizationMessage({
      receiptDigest: body.receipt.integrity.digest, receiptId: body.receipt.receiptId, receiptCreatedAt: body.receipt.createdAt, venueId: body.receipt.marketSnapshot.venueId,
      marketId: body.receipt.marketSnapshot.marketId, snapshotAt: body.receipt.marketSnapshot.capturedAt,
      marketExpiry: body.receipt.marketSnapshot.expiry, size: body.receipt.hedgePlan.normalizedShares,
      worstPrice: body.receipt.hedgePlan.worstPrice, maximumPremium: body.receipt.intent.normalized.maxPremium,
      collateralSymbol: body.receipt.marketSnapshot.collateral.symbol
    });
    if (body.message !== expected) throw new Error("Authorization message does not reproduce from the sealed receipt");
    const deadline = Math.min(Date.parse(body.receipt.marketSnapshot.expiry), Date.parse(body.receipt.createdAt) + 120_000);
    if (Date.now() > deadline) throw new Error("Intent authorization deadline has passed; refresh the plan");
    const recovered = await recoverMessageAddress({ message: body.message, signature: body.signature as `0x${string}` });
    if (recovered.toLowerCase() !== body.signer.toLowerCase()) throw new Error("Signature does not match the claimed signer");
    const { integrity: _integrity, receiptId: _receiptId, ...receiptBody } = body.receipt;
    void _integrity; void _receiptId;
    const policyEvaluation = receiptBody.policyEvaluation.map((policy) => policy.policyId === "authorization.human" ? { ...policy, status: "PASS" as const, observed: true, reason: "Wallet intent signature was cryptographically verified." } : policy);
    const authorizedReceipt = sealReceipt({ ...receiptBody, createdAt: new Date().toISOString(), policyEvaluation, authorization: { method: "wallet-signature", signer: recovered, signedPayloadHash: sha256(body.message), approvedAt: new Date().toISOString(), snapshotDigest: body.receipt.integrity.digest }, previousReceiptDigest: body.receipt.integrity.digest });
    const executionBundle = executionBundleSchema.parse({ schemaVersion: "outcomeguard.execution-bundle.v1", createdAt: new Date().toISOString(), preExecutionReceipt: body.receipt, authorizedReceipt, message: body.message, signature: body.signature, signer: recovered });
    return Response.json({ authorizedReceipt, executionBundle });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
