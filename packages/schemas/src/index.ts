import { z } from "zod";

export const decimalString = z.string().regex(/^(0|[1-9]\d*)(\.\d+)?$/, "must be an unsigned decimal string");
export const integerString = z.string().regex(/^(0|[1-9]\d*)$/, "must be an unsigned integer string");
export const positiveIntegerString = integerString.refine((value) => BigInt(value) > 0n, "must be positive");
export const uint64String = positiveIntegerString.refine((value) => BigInt(value) <= 18_446_744_073_709_551_615n, "must fit uint64");
export const hexString = z.string().regex(/^0x[0-9a-fA-F]+$/);
export const addressString = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 20-byte EVM address");
export const bytes32String = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be 32 bytes");
export const isoDate = z.string().datetime({ offset: true });
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.null(), z.boolean(), z.number().finite(), z.string(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

export const hedgeIntentSchema = z.object({
  asset: z.enum(["BTC", "ETH"]),
  exposureUsd: z.number().positive().finite(),
  horizonMinutes: z.union([z.literal(15), z.literal(60)]),
  adverseMovePct: z.number().positive().max(25),
  maxPremium: z.number().positive(),
  maxSlippagePct: z.number().min(0).max(10),
  targetProtectionPct: z.number().positive().max(100)
}).strict();
export type HedgeIntent = z.infer<typeof hedgeIntentSchema>;

export const portfolioSnapshotSchema = z.object({
  capturedAt: isoDate,
  source: z.enum(["wallet", "manual-demo", "fixture"]),
  owner: z.string().optional(),
  asset: z.enum(["BTC", "ETH"]),
  assetQuantity: decimalString.optional(),
  spotPriceUsd: decimalString.optional(),
  exposureUsd: decimalString,
  readStatus: z.enum(["known", "unknown"])
}).strict();
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;

export const bookLevelSchema = z.object({ price: decimalString, size: decimalString }).strict();
export const eventMarketSnapshotSchema = z.object({
  capturedAt: isoDate,
  source: z.enum(["live", "fixture", "verified-replay"]),
  network: z.literal("somnia-shannon"),
  chainId: z.literal(50312),
  sdkVersion: z.string(),
  venueId: bytes32String,
  marketId: bytes32String,
  poolAddress: addressString,
  asset: z.enum(["BTC", "ETH"]),
  intervalSec: z.number().int().positive(),
  strike: decimalString,
  expiry: isoDate,
  status: z.enum(["Listed", "Trading", "Locked", "Settling", "Resolved", "Voided"]),
  statusCode: z.number().int().min(0).max(5),
  settlementReference: z.string().min(1),
  oracleQuestionId: z.string().optional(),
  collateral: z.object({ symbol: z.string(), address: addressString, decimals: z.number().int().min(0).max(36) }).strict(),
  book: z.object({ yesBids: z.array(bookLevelSchema), yesAsks: z.array(bookLevelSchema) }).strict(),
  bookParams: z.object({ tickSize: decimalString, lotSize: decimalString, minQuantity: decimalString }).strict(),
  freshnessMs: z.number().nonnegative(),
  blockNumber: decimalString.optional()
}).strict();
export type EventMarketSnapshot = z.infer<typeof eventMarketSnapshotSchema>;

export const scenarioSchema = z.object({
  adverseMovePct: z.number(),
  contractOutcome: z.enum(["DOWN", "UP"]),
  underlyingPnlUsd: z.number(),
  eventPayoutUsd: z.number(),
  premiumUsd: z.number().nonnegative(),
  hedgedPnlUsd: z.number(),
  protectionRatioPct: z.number().nonnegative()
}).strict();

export const hedgePlanSchema = z.object({
  planVersion: z.literal("1.0.0"),
  objective: z.enum(["BUY_DOWN_PROTECTION"]),
  marketId: bytes32String,
  requestedShares: z.number().nonnegative(),
  executableShares: z.number().nonnegative(),
  normalizedShares: z.number().nonnegative(),
  worstPrice: z.number().positive().max(1),
  averageExecutablePrice: z.number().positive().max(1),
  premiumUsd: z.number().nonnegative(),
  expectedNetPayoutIfDownUsd: z.number().nonnegative(),
  targetProtectedLossUsd: z.number().nonnegative(),
  constraints: z.array(z.object({ name: z.string(), before: z.number(), after: z.number(), binding: z.boolean() }).strict()),
  scenarios: z.array(scenarioSchema),
  basisRiskWarning: z.string().min(1),
  calculationHash: hexString.optional()
}).strict();
export type HedgePlan = z.infer<typeof hedgePlanSchema>;

export const policyResultSchema = z.object({
  policyId: z.string(), version: z.string(), status: z.enum(["PASS", "FAIL", "WARN"]),
  observed: jsonValueSchema, limit: jsonValueSchema, reason: z.string(), evidenceRefs: z.array(z.string())
}).strict();
export type PolicyResult = z.infer<typeof policyResultSchema>;

export const executionProposalSchema = z.object({
  schemaVersion: z.literal("outcomeguard.execution-proposal.v1"),
  chainId: z.literal(50312), venueId: bytes32String, marketId: bytes32String,
  pool: addressString, poolNonce: integerString, outcomeToken: addressString,
  yesId: integerString, noId: integerString, outcome: z.literal("NO"), side: z.literal("BUY_NO"), orderType: z.literal("IOC"),
  yesPriceRaw: positiveIntegerString, outcomePriceRaw: positiveIntegerString, quantityRaw: positiveIntegerString,
  maximumPremiumRaw: positiveIntegerString, estimatedPremiumRaw: positiveIntegerString, visibleExecutableQuantityRaw: positiveIntegerString,
  orderExpiryNs: uint64String, observedBestAskRaw: positiveIntegerString, maximumBookMoveBps: integerString,
  authorizationFingerprint: bytes32String, preparedAt: isoDate,
  marketSnapshotDigest: bytes32String, snapshotCapturedAt: isoDate, executionSigner: addressString
}).strict();
export type ExecutionProposal = z.infer<typeof executionProposalSchema>;

export const executionMandateSchema = executionProposalSchema.extend({
  proposalSchemaVersion: z.literal("outcomeguard.execution-proposal.v1"),
  schemaVersion: z.literal("outcomeguard.execution-mandate.v1"),
  receiptDigest: bytes32String,
  receiptId: z.string().uuid(),
  authorizationDeadline: isoDate,
  autoRedeem: z.literal(false)
}).strict();
export type ExecutionMandate = z.infer<typeof executionMandateSchema>;

export const authorizationSchema = z.object({
  method: z.enum(["wallet-signature", "dedicated-test-agent"]),
  signer: z.string(),
  signedPayloadHash: bytes32String.optional(),
  approvedAt: isoDate.optional(),
  preExecutionReceiptDigest: bytes32String.optional(),
  mandateDigest: bytes32String.optional()
}).strict();

export const receiptCoreSchema = z.object({
  schemaVersion: z.literal("1.0.0"), receiptId: z.string().uuid(), createdAt: isoDate,
  lifecycleStage: z.enum(["PRE_EXECUTION", "EXECUTION", "SETTLEMENT", "REDEMPTION"]),
  network: z.object({ name: z.literal("somnia-shannon"), chainId: z.literal(50312) }).strict(),
  intent: z.object({ originalText: z.string().optional(), normalized: hedgeIntentSchema, intentHash: bytes32String }).strict(),
  portfolioBefore: portfolioSnapshotSchema,
  marketSnapshot: eventMarketSnapshotSchema,
  hedgePlan: hedgePlanSchema,
  executionProposal: executionProposalSchema.optional(),
  policyEvaluation: z.array(policyResultSchema),
  authorization: authorizationSchema,
  execution: z.object({
    status: z.enum(["NOT_SUBMITTED", "SUBMITTED", "CONFIRMED", "REVERTED", "RECONCILED"]),
    txHash: bytes32String.optional(), blockNumber: decimalString.optional(), orderId: decimalString.optional(),
    requestedPrice: decimalString.optional(), averageFillPrice: decimalString.optional(),
    requestedSize: decimalString.optional(), filledSize: decimalString.optional(), explorerUrl: z.string().url().optional(),
    position: z.object({
      marketId: bytes32String, account: addressString,
      yesBefore: decimalString, noBefore: decimalString, yesAfter: decimalString, noAfter: decimalString,
      filledOutcome: z.enum(["YES", "NO"]), positionDelta: decimalString, collateralSpent: decimalString
    }).strict().optional()
  }).strict(),
  portfolioAfter: portfolioSnapshotSchema.optional(),
  settlement: z.object({ marketStatus: z.string(), outcome: z.enum(["UP", "DOWN", "VOID"]).optional(), claimable: decimalString.optional(), settlementEvidence: z.array(z.string()).optional() }).strict().optional(),
  redemption: z.object({ txHash: bytes32String.optional(), amount: decimalString.optional(), explorerUrl: z.string().url().optional() }).strict().optional(),
  integrity: z.object({ canonicalization: z.literal("RFC8785-JCS"), digestAlgorithm: z.literal("sha256"), digest: bytes32String, previousReceiptDigest: bytes32String.optional() }).strict()
}).strict().superRefine((receipt, ctx) => {
  const executionEvidence = receipt.execution.txHash && receipt.execution.blockNumber && receipt.execution.requestedSize && receipt.execution.filledSize && receipt.execution.explorerUrl;
  if (receipt.execution.status === "SUBMITTED" && !receipt.execution.txHash) ctx.addIssue({ code: "custom", path: ["execution", "txHash"], message: "submitted execution requires a transaction hash" });
  if (["CONFIRMED", "RECONCILED"].includes(receipt.execution.status) && !executionEvidence) ctx.addIssue({ code: "custom", path: ["execution"], message: "confirmed/reconciled execution requires tx, block, sizes, and explorer evidence" });
  if (receipt.execution.status === "RECONCILED" && !receipt.portfolioAfter) ctx.addIssue({ code: "custom", path: ["portfolioAfter"], message: "reconciled execution requires a post-execution portfolio snapshot" });
  if (receipt.execution.status === "RECONCILED" && !receipt.execution.position) ctx.addIssue({ code: "custom", path: ["execution", "position"], message: "reconciled execution requires on-chain position evidence" });
  if (receipt.lifecycleStage === "EXECUTION" && !["SUBMITTED", "CONFIRMED", "RECONCILED", "REVERTED"].includes(receipt.execution.status)) ctx.addIssue({ code: "custom", path: ["execution", "status"], message: "execution lifecycle cannot be NOT_SUBMITTED" });
  if (["SETTLEMENT", "REDEMPTION"].includes(receipt.lifecycleStage) && (!receipt.settlement?.outcome || !receipt.settlement.settlementEvidence?.length)) ctx.addIssue({ code: "custom", path: ["settlement"], message: "terminal lifecycle requires outcome and settlement evidence" });
  if (receipt.lifecycleStage === "REDEMPTION" && (!receipt.redemption?.txHash || !receipt.redemption.amount || !receipt.redemption.explorerUrl)) ctx.addIssue({ code: "custom", path: ["redemption"], message: "redemption lifecycle requires transaction, amount, and explorer evidence" });
  if (receipt.authorization.approvedAt && (!receipt.authorization.signedPayloadHash || !receipt.authorization.preExecutionReceiptDigest || !receipt.authorization.mandateDigest || !receipt.executionProposal || !/^0x[0-9a-fA-F]{40}$/.test(receipt.authorization.signer))) ctx.addIssue({ code: "custom", path: ["authorization"], message: "approved wallet authorization requires signer, payload, pre-execution receipt and mandate digests, and exact execution proposal" });
});
export type OutcomeGuardReceipt = z.infer<typeof receiptCoreSchema>;

export const executionBundleSchema = z.object({
  schemaVersion: z.literal("outcomeguard.execution-bundle.v1"),
  createdAt: isoDate,
  preExecutionReceipt: receiptCoreSchema,
  authorizedReceipt: receiptCoreSchema,
  mandate: executionMandateSchema,
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "must be a 65-byte EVM signature"),
  signer: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
}).strict().superRefine((bundle, ctx) => {
  if (bundle.preExecutionReceipt.lifecycleStage !== "PRE_EXECUTION") ctx.addIssue({ code: "custom", path: ["preExecutionReceipt", "lifecycleStage"], message: "bundle must start from a pre-execution receipt" });
  if (bundle.authorizedReceipt.lifecycleStage !== "PRE_EXECUTION") ctx.addIssue({ code: "custom", path: ["authorizedReceipt", "lifecycleStage"], message: "authorization must not claim execution" });
  if (bundle.authorizedReceipt.integrity.previousReceiptDigest?.toLowerCase() !== bundle.preExecutionReceipt.integrity.digest.toLowerCase()) ctx.addIssue({ code: "custom", path: ["authorizedReceipt", "integrity", "previousReceiptDigest"], message: "authorized receipt must link to the pre-execution digest" });
  if (bundle.authorizedReceipt.authorization.preExecutionReceiptDigest?.toLowerCase() !== bundle.preExecutionReceipt.integrity.digest.toLowerCase()) ctx.addIssue({ code: "custom", path: ["authorizedReceipt", "authorization", "preExecutionReceiptDigest"], message: "authorization must bind the pre-execution digest" });
  if (bundle.authorizedReceipt.authorization.signer.toLowerCase() !== bundle.signer.toLowerCase()) ctx.addIssue({ code: "custom", path: ["signer"], message: "bundle signer must match the authorized receipt" });
  if (bundle.mandate.receiptDigest.toLowerCase() !== bundle.preExecutionReceipt.integrity.digest.toLowerCase() || bundle.mandate.receiptId !== bundle.preExecutionReceipt.receiptId) ctx.addIssue({ code: "custom", path: ["mandate"], message: "mandate must identify the sealed pre-execution receipt" });
  const { schemaVersion: _schemaVersion, proposalSchemaVersion: _proposalSchemaVersion, receiptDigest: _receiptDigest, receiptId: _receiptId, authorizationDeadline: _authorizationDeadline, autoRedeem: _autoRedeem, ...mandateOrder } = bundle.mandate;
  void _schemaVersion; void _proposalSchemaVersion; void _receiptDigest; void _receiptId; void _authorizationDeadline; void _autoRedeem;
  const proposalFromMandate = { schemaVersion: bundle.mandate.proposalSchemaVersion, ...mandateOrder };
  if (!bundle.preExecutionReceipt.executionProposal || JSON.stringify(proposalFromMandate) !== JSON.stringify(bundle.preExecutionReceipt.executionProposal)) ctx.addIssue({ code: "custom", path: ["mandate"], message: "mandate order must exactly match the sealed execution proposal" });
});
export type ExecutionBundle = z.infer<typeof executionBundleSchema>;
