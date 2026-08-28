import { describe, expect, it } from "vitest";
import type { ExecutionBundle, OutcomeGuardReceipt } from "@outcome-guard/schemas";
import { sealReceipt, sha256, verifyExecutionBundle, verifyReceipt, verifyReceiptChain } from "./index.js";

const input: Omit<OutcomeGuardReceipt, "receiptId" | "integrity"> = {
  schemaVersion: "1.0.0", createdAt: "2026-08-28T06:00:00.000Z", lifecycleStage: "PRE_EXECUTION",
  network: { name: "somnia-shannon", chainId: 50312 },
  intent: { originalText: "Protect ETH", normalized: { asset: "ETH", exposureUsd: 1000, horizonMinutes: 60, adverseMovePct: 2, maxPremium: 15, maxSlippagePct: 2, targetProtectionPct: 75 }, intentHash: `0x${"a".repeat(64)}` },
  portfolioBefore: { capturedAt: "2026-08-28T06:00:00.000Z", source: "fixture", asset: "ETH", exposureUsd: "1000", readStatus: "known" },
  marketSnapshot: { capturedAt: "2026-08-28T06:00:00.000Z", source: "fixture", network: "somnia-shannon", chainId: 50312, sdkVersion: "0.28.1", venueId: `0x${"b".repeat(64)}`, marketId: `0x${"c".repeat(64)}`, poolAddress: `0x${"d".repeat(40)}`, asset: "ETH", intervalSec: 3600, strike: "4500", expiry: "2026-08-28T07:00:00.000Z", status: "Trading", statusCode: 1, settlementReference: "oracle", collateral: { symbol: "tUSDC", address: `0x${"e".repeat(40)}`, decimals: 6 }, book: { yesBids: [{ price: "0.58", size: "100" }], yesAsks: [{ price: "0.60", size: "100" }] }, bookParams: { tickSize: "0.001", lotSize: "0.001", minQuantity: "0.001" }, freshnessMs: 100 },
  hedgePlan: { planVersion: "1.0.0", objective: "BUY_DOWN_PROTECTION", marketId: `0x${"c".repeat(64)}`, requestedShares: 30, executableShares: 30, normalizedShares: 30, worstPrice: 0.42, averageExecutablePrice: 0.42, premiumUsd: 12.6, expectedNetPayoutIfDownUsd: 17.4, targetProtectedLossUsd: 15, constraints: [], scenarios: [], basisRiskWarning: "Binary basis risk exists." },
  policyEvaluation: [], authorization: { method: "wallet-signature", signer: "0x0000000000000000000000000000000000000000" }, execution: { status: "NOT_SUBMITTED" }
};

describe("receipt integrity", () => {
  it("verifies a sealed receipt and exposes any tampering", () => {
    const receipt = sealReceipt(input);
    expect(verifyReceipt(receipt).valid).toBe(true);
    const tampered = structuredClone(receipt);
    tampered.hedgePlan.premiumUsd = 1;
    expect(verifyReceipt(tampered).valid).toBe(false);
  });
  it("requires linked immutable lifecycle receipts", () => {
    const pre = sealReceipt(input);
    const execution = sealReceipt({ ...input, lifecycleStage: "EXECUTION", execution: { status: "SUBMITTED", txHash: `0x${"f".repeat(64)}` }, previousReceiptDigest: pre.integrity.digest });
    expect(verifyReceiptChain([pre, execution]).valid).toBe(true);
    execution.integrity.previousReceiptDigest = `0x${"0".repeat(64)}`;
    expect(verifyReceiptChain([pre, execution]).valid).toBe(false);
  });
  it("rejects unsupported confirmation and redemption claims even when shaped like receipts", () => {
    const pre = sealReceipt(input);
    const falseConfirmation = structuredClone(pre) as unknown as Record<string, unknown>;
    falseConfirmation.lifecycleStage = "EXECUTION";
    falseConfirmation.execution = { status: "CONFIRMED", txHash: `0x${"f".repeat(64)}` };
    expect(verifyReceipt(falseConfirmation).valid).toBe(false);

    const falseRedemption = structuredClone(pre) as unknown as Record<string, unknown>;
    falseRedemption.lifecycleStage = "REDEMPTION";
    falseRedemption.redemption = { amount: "100" };
    expect(verifyReceipt(falseRedemption).valid).toBe(false);
  });
  it("rejects lifecycle regression even when every receipt digest is valid", () => {
    const pre = sealReceipt(input);
    const execution = sealReceipt({ ...input, lifecycleStage: "EXECUTION", execution: { status: "SUBMITTED", txHash: `0x${"f".repeat(64)}` }, previousReceiptDigest: pre.integrity.digest });
    const regressed = sealReceipt({ ...input, createdAt: "2026-08-28T06:01:00.000Z", previousReceiptDigest: execution.integrity.digest });
    expect(verifyReceiptChain([pre, execution, regressed]).valid).toBe(false);
  });
  it("verifies a linked execution bundle and rejects signer substitution", () => {
    const pre = sealReceipt(input);
    const signer = `0x${"1".repeat(40)}`;
    const message = "OutcomeGuard intent authorization v1";
    const { integrity: _integrity, receiptId: _receiptId, ...body } = pre;
    void _integrity; void _receiptId;
    const authorized = sealReceipt({
      ...body,
      createdAt: "2026-08-28T06:00:01.000Z",
      authorization: { method: "wallet-signature", signer, signedPayloadHash: sha256(message), approvedAt: "2026-08-28T06:00:01.000Z", snapshotDigest: pre.integrity.digest },
      previousReceiptDigest: pre.integrity.digest
    });
    const bundle: ExecutionBundle = { schemaVersion: "outcomeguard.execution-bundle.v1", createdAt: "2026-08-28T06:00:01.000Z", preExecutionReceipt: pre, authorizedReceipt: authorized, message, signature: `0x${"2".repeat(130)}`, signer };
    expect(verifyExecutionBundle(bundle).valid).toBe(true);
    const substituted = structuredClone(bundle);
    substituted.signer = `0x${"3".repeat(40)}`;
    expect(verifyExecutionBundle(substituted).valid).toBe(false);
  });
});
