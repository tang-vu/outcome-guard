import { recoverMessageAddress } from "viem";
import { computeMandateDigest, computeMarketSnapshotDigest, sealReceipt, sha256, verifyExecutionBundle, verifyReceipt } from "@outcome-guard/receipt";
import { executionBundleSchema, executionMandateSchema, receiptCoreSchema } from "@outcome-guard/schemas";
import { executionMandateMessage } from "@outcome-guard/shared";
import { z } from "zod";
import { automaticExecutionEnabled, configuredHumanAuthorizer, enqueueExecutionBundle } from "../../../lib/execution-queue";

const requestSchema = z.object({
  receipt: receiptCoreSchema,
  mandate: executionMandateSchema,
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  signer: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
}).strict();

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const receiptVerification = verifyReceipt(body.receipt);
    if (!receiptVerification.valid) throw new Error(`Pre-execution receipt verification failed: ${receiptVerification.errors.join("; ")}`);
    if (!body.receipt.executionProposal) throw new Error("Receipt has no exact execution proposal; derive a live plan with a configured worker signer");
    const configuredSigner = process.env.AGENT_SIGNER_ADDRESS;
    if (!configuredSigner || !/^0x[0-9a-fA-F]{40}$/.test(configuredSigner)) throw new Error("Exact authorization is disabled until AGENT_SIGNER_ADDRESS is configured");
    if (body.mandate.executionSigner.toLowerCase() !== configuredSigner.toLowerCase()) throw new Error("Mandate targets an execution signer that is not configured by this deployment");
    if (body.mandate.receiptDigest.toLowerCase() !== body.receipt.integrity.digest.toLowerCase() || body.mandate.receiptId !== body.receipt.receiptId) throw new Error("Mandate does not identify this receipt");
    if (body.mandate.marketSnapshotDigest.toLowerCase() !== computeMarketSnapshotDigest(body.receipt.marketSnapshot).toLowerCase() || body.mandate.snapshotCapturedAt !== body.receipt.marketSnapshot.capturedAt) throw new Error("Mandate market snapshot does not reproduce");
    const { schemaVersion: _mandateVersion, proposalSchemaVersion, receiptDigest: _receiptDigest, receiptId: _receiptId, authorizationDeadline, autoRedeem: _autoRedeem, ...mandateOrder } = body.mandate;
    void _mandateVersion; void _receiptDigest; void _receiptId; void _autoRedeem;
    if (JSON.stringify({ schemaVersion: proposalSchemaVersion, ...mandateOrder }) !== JSON.stringify(body.receipt.executionProposal)) throw new Error("Mandate raw order does not match the sealed proposal");
    const deadline = Math.min(Date.parse(body.receipt.marketSnapshot.expiry), Date.parse(body.receipt.createdAt) + 120_000);
    if (authorizationDeadline !== new Date(deadline).toISOString() || Date.now() >= deadline) throw new Error("Exact authorization deadline has passed or does not reproduce; refresh the plan");
    const mandateDigest = computeMandateDigest(body.mandate);
    const expected = executionMandateMessage(body.mandate, mandateDigest);
    const recovered = await recoverMessageAddress({ message: expected, signature: body.signature as `0x${string}` });
    if (recovered.toLowerCase() !== body.signer.toLowerCase()) throw new Error("Signature does not match the claimed signer");
    if (automaticExecutionEnabled() && recovered.toLowerCase() !== configuredHumanAuthorizer().toLowerCase()) throw new Error("Signer is not authorized to spend from this deployment's dedicated execution wallet");
    const { integrity: _integrity, receiptId: _sealedReceiptId, ...receiptBody } = body.receipt;
    void _integrity; void _sealedReceiptId;
    const policyEvaluation = receiptBody.policyEvaluation.map((policy) => policy.policyId === "authorization.human" ? { ...policy, status: "PASS" as const, observed: true, reason: "Wallet intent signature was cryptographically verified." } : policy);
    const authorizedReceipt = sealReceipt({ ...receiptBody, createdAt: new Date().toISOString(), policyEvaluation, authorization: { method: "wallet-signature", signer: recovered, signedPayloadHash: sha256(expected), approvedAt: new Date().toISOString(), preExecutionReceiptDigest: body.receipt.integrity.digest, mandateDigest }, previousReceiptDigest: body.receipt.integrity.digest });
    const executionBundle = executionBundleSchema.parse({ schemaVersion: "outcomeguard.execution-bundle.v1", createdAt: new Date().toISOString(), preExecutionReceipt: body.receipt, authorizedReceipt, mandate: body.mandate, message: expected, signature: body.signature, signer: recovered });
    const verification = await verifyExecutionBundle(executionBundle, { nowMs: Date.now(), executionSigner: configuredSigner });
    if (!verification.valid) throw new Error(`Execution bundle verification failed: ${verification.errors.join("; ")}`);
    const execution = automaticExecutionEnabled() ? { queued: true, ...await enqueueExecutionBundle(executionBundle) } : { queued: false };
    return Response.json({ authorizedReceipt, executionBundle, execution });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
