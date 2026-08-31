import { executionBundleSchema, type OutcomeGuardReceipt, type PolicyResult } from "@outcome-guard/schemas";
import { sealReceipt, sha256, verifyExecutionBundle } from "@outcome-guard/receipt";
import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { enqueueExecutionBundle, readExecutionStatus } from "../apps/web/lib/execution-queue";

const env = z.object({
  PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  AGENT_SIGNER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  EXECUTION_INBOX_DIR: z.string().min(1),
  EXECUTION_STATUS_DIR: z.string().min(1),
  OUTCOMEGUARD_URL: z.string().url().default("https://outcomeguard.tangvu.dev")
}).parse(process.env);

type MarketResponse = {
  source: string;
  snapshots?: Array<{ market: { marketId: string; asset: "BTC" | "ETH"; intervalSec: number; pool: string; statusName: string } }>;
  error?: string;
};

type PlanResponse = {
  mode: string;
  policies: PolicyResult[];
  receipt: OutcomeGuardReceipt;
  authorizationChallenge?: { mandate: Record<string, unknown>; mandateDigest: `0x${string}`; message: string };
  error?: string;
};

async function json<T>(response: Response): Promise<T> {
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
  return value;
}

async function main(): Promise<void> {
  const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
  if (account.address.toLowerCase() !== env.AGENT_SIGNER_ADDRESS.toLowerCase()) throw new Error("Dedicated test-agent key does not match AGENT_SIGNER_ADDRESS");
  process.env.AUTO_EXECUTION_ENABLED = "true";

  const markets = await json<MarketResponse>(await fetch(`${env.OUTCOMEGUARD_URL}/api/markets`, { cache: "no-store" }));
  const candidates = markets.snapshots?.filter(({ market }) => market.statusName === "Trading" && (market.intervalSec === 900 || market.intervalSec === 3600)) ?? [];
  let selected: (typeof candidates)[number] | undefined;
  let plan: PlanResponse | undefined;
  const rejected: string[] = [];
  for (const candidate of candidates) {
    const candidatePlan = await json<PlanResponse>(await fetch(`${env.OUTCOMEGUARD_URL}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ asset: candidate.market.asset, exposureUsd: 1000, horizonMinutes: candidate.market.intervalSec / 60, adverseMovePct: 2, maxPremium: 15, maxSlippagePct: 2, targetProtectionPct: 75, liveMarketId: candidate.market.marketId })
    }));
    const blocking = candidatePlan.policies.filter(({ status, policyId }) => status === "FAIL" && !["premium.total-risk", "wallet.gas", "authorization.human"].includes(policyId));
    if (candidatePlan.mode === "live" && candidatePlan.authorizationChallenge && blocking.length === 0) {
      selected = candidate;
      plan = candidatePlan;
      break;
    }
    rejected.push(`${candidate.market.asset}-${candidate.market.intervalSec / 60}m:${blocking.map(({ policyId }) => policyId).join("+") || "no-challenge"}`);
  }
  if (!selected || !plan?.authorizationChallenge) throw new Error(`No live market is currently authorizable (${rejected.join(", ") || markets.error || "empty discovery"})`);

  const chain = defineChain({ id: 50312, name: "Somnia Shannon", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 }, rpcUrls: { default: { http: ["https://api.infra.testnet.somnia.network"] } }, testnet: true });
  const transport = http("https://api.infra.testnet.somnia.network");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const token = plan.receipt.marketSnapshot.collateral.address as `0x${string}`;
  const pool = selected.market.pool as `0x${string}`;
  const amount = parseUnits("15", plan.receipt.marketSnapshot.collateral.decimals);
  const approvalAbi = [
    { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] }
  ] as const;
  const allowance = await publicClient.readContract({ address: token, abi: approvalAbi, functionName: "allowance", args: [account.address, pool] });
  let approvalTxHash: `0x${string}` | undefined;
  if (allowance !== amount) {
    const { request } = await publicClient.simulateContract({ account, address: token, abi: approvalAbi, functionName: "approve", args: [pool, amount] });
    approvalTxHash = await walletClient.writeContract(request);
    const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
    if (approvalReceipt.status !== "success") throw new Error(`Bounded E2E approval reverted: ${approvalTxHash}`);
  }

  const approvedAt = new Date().toISOString();
  const signature = await account.signMessage({ message: plan.authorizationChallenge.message });
  const { integrity: _integrity, receiptId: _receiptId, ...receiptBody } = plan.receipt;
  void _integrity; void _receiptId;
  const policyEvaluation = receiptBody.policyEvaluation.map((policy) => policy.policyId === "authorization.human"
    ? { ...policy, status: "PASS" as const, observed: true, reason: "Dedicated test agent signed the exact E2E mandate; this is not represented as a human approval." }
    : policy);
  const authorizedReceipt = sealReceipt({
    ...receiptBody,
    createdAt: approvedAt,
    policyEvaluation,
    authorization: {
      method: "dedicated-test-agent",
      signer: account.address,
      signedPayloadHash: sha256(plan.authorizationChallenge.message),
      approvedAt,
      preExecutionReceiptDigest: plan.receipt.integrity.digest,
      mandateDigest: plan.authorizationChallenge.mandateDigest
    },
    previousReceiptDigest: plan.receipt.integrity.digest
  });
  const bundle = executionBundleSchema.parse({
    schemaVersion: "outcomeguard.execution-bundle.v1",
    createdAt: approvedAt,
    preExecutionReceipt: plan.receipt,
    authorizedReceipt,
    mandate: plan.authorizationChallenge.mandate,
    message: plan.authorizationChallenge.message,
    signature,
    signer: account.address
  });
  const verification = await verifyExecutionBundle(bundle, { nowMs: Date.now(), executionSigner: account.address });
  if (!verification.valid) throw new Error(`Dedicated E2E bundle failed verification: ${verification.errors.join("; ")}`);
  const queued = await enqueueExecutionBundle(bundle);
  const deadline = Date.now() + 110_000;
  while (Date.now() < deadline) {
    const status = await readExecutionStatus(queued.executionId);
    if (status && ["FAILED", "RECONCILED", "RECOVERY_REQUIRED"].includes(status.state)) {
      console.log(JSON.stringify({ testMode: "dedicated-test-agent", marketId: selected.market.marketId, pool: selected.market.pool, ...(approvalTxHash ? { approvalTxHash } : {}), ...status }));
      if (status.state !== "RECONCILED") throw new Error(status.error ?? `E2E ended in ${status.state}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Dedicated E2E timed out waiting for worker reconciliation");
}

void main().then(() => process.exit(0)).catch((error) => {
  console.error(JSON.stringify({ testMode: "dedicated-test-agent", status: "FAILED", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
