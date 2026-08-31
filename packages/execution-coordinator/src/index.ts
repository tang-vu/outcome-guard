import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { ExecutionBundle } from "@outcome-guard/schemas";
import type { OutcomeGuardReceipt } from "@outcome-guard/schemas";
import { canonicalize, sha256, verifyExecutionBundle, verifyReceipt } from "@outcome-guard/receipt";
import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const eventSchema = z.enum([
  "JOB_ACCEPTED", "PREFLIGHT_PASSED", "SUBMISSION_INTENT_RECORDED", "TX_BROADCAST", "TX_MINED_SUCCESS",
  "TX_MINED_REVERT", "TX_ZERO_FILL", "POSITION_RECONCILED", "RECEIPT_SEALED", "AMBIGUOUS_SUBMISSION", "TERMINAL_FAILURE"
]);
export type JournalEvent = z.infer<typeof eventSchema>;

const journalRecordSchema = z.object({
  schemaVersion: z.literal("outcomeguard.execution-journal.v1"), sequence: z.number().int().positive(), recordedAt: z.string().datetime({ offset: true }),
  event: eventSchema, jobId: bytes32, signer: address, chainId: z.literal(50312), authorizationDigest: bytes32, orderFingerprint: bytes32,
  txHash: bytes32.optional(), blockNumber: z.string().regex(/^(0|[1-9]\d*)$/).optional(), evidenceDigest: bytes32.optional(),
  detail: z.string().max(500).optional(), previousEventHash: bytes32.optional(), eventHash: bytes32
}).strict();
export type JournalRecord = z.infer<typeof journalRecordSchema>;

type RecordInput = Omit<JournalRecord, "schemaVersion" | "sequence" | "recordedAt" | "previousEventHash" | "eventHash">;

function recordDigest(record: Omit<JournalRecord, "eventHash">): `0x${string}` {
  return sha256(canonicalize(record as never));
}

function safeSignerName(signer: string): string {
  return address.parse(signer).toLowerCase();
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } catch (error) {
    if (!(process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM")) throw error;
  } finally { await handle.close(); }
}

export function executionJobId(bundle: ExecutionBundle): `0x${string}` {
  const mandateDigest = bundle.authorizedReceipt.authorization.mandateDigest;
  if (!mandateDigest) throw new Error("authorized bundle has no mandate digest");
  return bytes32.parse(mandateDigest) as `0x${string}`;
}

export class DurableExecutionJournal {
  readonly root: string;
  readonly signer: string;
  readonly signerDirectory: string;
  readonly journalPath: string;
  private lockDirectory: string;
  private locked = false;
  private records: JournalRecord[] = [];
  private tail: Promise<unknown> = Promise.resolve();

  constructor(stateDirectory: string, signer: string) {
    if (!isAbsolute(stateDirectory)) throw new Error("EXECUTION_STATE_DIR must be an absolute path");
    this.root = resolve(stateDirectory);
    this.signer = safeSignerName(signer);
    this.signerDirectory = join(this.root, "signers", this.signer);
    this.journalPath = join(this.signerDirectory, "journal.jsonl");
    this.lockDirectory = join(this.signerDirectory, "instance.lock");
  }

  async initialize(): Promise<void> {
    await mkdir(this.signerDirectory, { recursive: true, mode: 0o700 });
    const rootStats = await stat(this.root);
    if (!rootStats.isDirectory()) throw new Error("execution state path is not a directory");
    const resolved = await realpath(this.root);
    if (resolved !== this.root) throw new Error("execution state directory must not traverse a symlink");
    await mkdir(join(this.signerDirectory, "claims"), { recursive: true, mode: 0o700 });
    await mkdir(join(this.signerDirectory, "receipts"), { recursive: true, mode: 0o700 });
    this.records = await this.readAndVerify();
  }

  async acquireSignerLock(): Promise<void> {
    try { await mkdir(this.lockDirectory, { mode: 0o700 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("signer lock already exists; reconcile the prior process before explicit recovery", { cause: error });
      throw error;
    }
    try {
      await this.atomicWrite(join(this.lockDirectory, "owner.json"), `${JSON.stringify({ schemaVersion: "outcomeguard.signer-lock.v1", instanceId: randomUUID(), pid: process.pid, acquiredAt: new Date().toISOString(), signer: this.signer })}\n`);
      this.locked = true;
    } catch (error) {
      await rm(this.lockDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  async releaseSignerLock(): Promise<void> {
    if (!this.locked) return;
    await rm(this.lockDirectory, { recursive: true, force: false });
    await syncDirectory(this.signerDirectory);
    this.locked = false;
  }

  async claimBundle(bundle: ExecutionBundle, nowMs = Date.now()): Promise<{ claimed: true; jobId: `0x${string}` }> {
    if (!this.locked) throw new Error("signer lock is required before claiming an authorization");
    const verification = await verifyExecutionBundle(bundle, { nowMs, executionSigner: this.signer });
    if (!verification.valid) throw new Error(`execution bundle rejected: ${verification.errors.join("; ")}`);
    const jobId = executionJobId(bundle);
    const claimPath = join(this.signerDirectory, "claims", `${jobId}.json`);
    const claim = `${canonicalize({ schemaVersion: "outcomeguard.execution-claim.v1", jobId, receiptDigest: bundle.preExecutionReceipt.integrity.digest, mandateDigest: bundle.authorizedReceipt.authorization.mandateDigest!, signer: this.signer, claimedAt: new Date(nowMs).toISOString() })}\n`;
    try {
      const handle = await open(claimPath, "wx", 0o600);
      try { await handle.writeFile(claim, "utf8"); await handle.sync(); } finally { await handle.close(); }
      await syncDirectory(dirname(claimPath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("authorization was already claimed; replay blocked", { cause: error });
      throw error;
    }
    await this.append({ event: "JOB_ACCEPTED", jobId, signer: this.signer, chainId: 50312, authorizationDigest: bundle.authorizedReceipt.authorization.mandateDigest!, orderFingerprint: bundle.mandate.authorizationFingerprint });
    return { claimed: true, jobId };
  }

  append(input: RecordInput): Promise<JournalRecord> {
    const operation = this.tail.then(async () => {
      if (!this.locked) throw new Error("signer lock is required before appending execution state");
      const previous = this.records.at(-1);
      const unsigned = {
        schemaVersion: "outcomeguard.execution-journal.v1" as const, sequence: (previous?.sequence ?? 0) + 1, recordedAt: new Date().toISOString(),
        ...input, ...(previous ? { previousEventHash: previous.eventHash } : {})
      };
      const record = journalRecordSchema.parse({ ...unsigned, eventHash: recordDigest(unsigned) });
      const handle = await open(this.journalPath, "a", 0o600);
      try { await handle.writeFile(`${canonicalize(record as never)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
      this.records.push(record);
      return record;
    });
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  snapshot(): readonly JournalRecord[] { return structuredClone(this.records); }

  async persistReceipt(jobId: `0x${string}`, receipt: OutcomeGuardReceipt): Promise<string> {
    if (!this.locked) throw new Error("signer lock is required before persisting execution evidence");
    const verification = verifyReceipt(receipt);
    if (!verification.valid) throw new Error(`refusing invalid execution receipt: ${verification.errors.join("; ")}`);
    const path = join(this.signerDirectory, "receipts", `${bytes32.parse(jobId)}-execution.json`);
    try {
      const handle = await open(path, "wx", 0o600);
      try { await handle.writeFile(`${canonicalize(receipt as never)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
      await syncDirectory(dirname(path));
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("execution receipt already exists; refusing overwrite", { cause: error });
      throw error;
    }
    return path;
  }

  private async readAndVerify(): Promise<JournalRecord[]> {
    let text: string;
    try { text = await readFile(this.journalPath, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    if (text.length > 0 && !text.endsWith("\n")) throw new Error("execution journal has a torn final record; manual reconciliation is required");
    const records = text.split("\n").filter(Boolean).map((line) => journalRecordSchema.parse(JSON.parse(line)));
    for (let index = 0; index < records.length; index++) {
      const current = records[index]!;
      const previous = records[index - 1];
      if (current.sequence !== index + 1) throw new Error(`execution journal sequence is corrupt at ${index + 1}`);
      if ((current.previousEventHash ?? undefined) !== (previous?.eventHash ?? undefined)) throw new Error(`execution journal hash link is corrupt at ${index + 1}`);
      const { eventHash, ...unsigned } = current;
      if (recordDigest(unsigned).toLowerCase() !== eventHash.toLowerCase()) throw new Error(`execution journal record digest is corrupt at ${index + 1}`);
    }
    return records;
  }

  private async atomicWrite(path: string, content: string): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(content, "utf8"); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, path);
    await syncDirectory(dirname(path));
  }
}
