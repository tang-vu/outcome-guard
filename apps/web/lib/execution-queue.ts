import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { ExecutionBundle } from "@outcome-guard/schemas";

const digestPattern = /^0x[0-9a-fA-F]{64}$/;
export type ExecutionQueueState = "QUEUED" | "PROCESSING" | "FAILED" | "RECONCILED" | "RECOVERY_REQUIRED";
export type PublicExecutionStatus = {
  executionId: string;
  state: ExecutionQueueState;
  updatedAt: string;
  txHash?: string;
  blockNumber?: string;
  receiptDigest?: string;
  explorerUrl?: string;
  error?: string;
};

function requiredDirectory(name: "EXECUTION_INBOX_DIR" | "EXECUTION_STATUS_DIR"): string {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) throw new Error(`${name} must be an absolute path when automatic execution is enabled`);
  return resolve(value);
}

export function automaticExecutionEnabled(): boolean {
  return process.env.AUTO_EXECUTION_ENABLED === "true";
}

export function configuredHumanAuthorizer(): string {
  const value = process.env.AUTHORIZED_HUMAN_SIGNER;
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("AUTHORIZED_HUMAN_SIGNER must be configured for automatic execution");
  return value;
}

export function executionIdFor(bundle: ExecutionBundle): `0x${string}` {
  const digest = bundle.authorizedReceipt.authorization.mandateDigest;
  if (!digest || !digestPattern.test(digest)) throw new Error("Authorized receipt has no valid mandate digest");
  return digest as `0x${string}`;
}

function statusPath(executionId: string): string {
  if (!digestPattern.test(executionId)) throw new Error("Invalid execution identifier");
  return join(requiredDirectory("EXECUTION_STATUS_DIR"), `${executionId.slice(2).toLowerCase()}.json`);
}

async function writeExclusive(path: string, content: string): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(content, "utf8"); await handle.sync(); } finally { await handle.close(); }
}

export async function enqueueExecutionBundle(bundle: ExecutionBundle): Promise<{ executionId: `0x${string}`; statusUrl: string }> {
  const executionId = executionIdFor(bundle);
  const inbox = requiredDirectory("EXECUTION_INBOX_DIR");
  const statuses = requiredDirectory("EXECUTION_STATUS_DIR");
  await Promise.all([mkdir(inbox, { recursive: true, mode: 0o700 }), mkdir(statuses, { recursive: true, mode: 0o700 })]);
  const queuePath = join(inbox, `outcomeguard-${executionId.slice(2).toLowerCase()}.json`);
  const finalStatusPath = statusPath(executionId);
  const temporaryQueuePath = `${queuePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeExclusive(finalStatusPath, `${JSON.stringify({ executionId, state: "QUEUED", updatedAt: new Date().toISOString() })}\n`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("This exact mandate has already been queued; replay refused", { cause: error });
    throw error;
  }
  try {
    await writeExclusive(temporaryQueuePath, `${JSON.stringify(bundle, null, 2)}\n`);
    await rename(temporaryQueuePath, queuePath);
  } catch (error) {
    await rm(temporaryQueuePath, { force: true }).catch(() => undefined);
    await rm(finalStatusPath, { force: true }).catch(() => undefined);
    throw error;
  }
  return { executionId, statusUrl: `/api/executions/${executionId}` };
}

export async function readExecutionStatus(executionId: string): Promise<PublicExecutionStatus | undefined> {
  try {
    const stored = JSON.parse(await readFile(statusPath(executionId), "utf8")) as PublicExecutionStatus;
    const value: PublicExecutionStatus = {
      executionId: stored.executionId,
      state: stored.state,
      updatedAt: stored.updatedAt,
      ...(stored.txHash ? { txHash: stored.txHash } : {}),
      ...(stored.blockNumber ? { blockNumber: stored.blockNumber } : {}),
      ...(stored.receiptDigest ? { receiptDigest: stored.receiptDigest } : {}),
      ...(stored.explorerUrl ? { explorerUrl: stored.explorerUrl } : {}),
      ...(stored.error ? { error: stored.error } : {})
    };
    if (value.executionId.toLowerCase() !== executionId.toLowerCase()) throw new Error("Execution status identifier mismatch");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
