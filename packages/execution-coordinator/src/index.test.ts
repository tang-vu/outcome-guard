import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionBundle } from "@outcome-guard/schemas";
import { DurableExecutionJournal, executionJobId } from "./index.js";

const roots: string[] = [];
const signer = `0x${"1".repeat(40)}`;
const hash = (digit: string) => `0x${digit.repeat(64)}` as `0x${string}`;

async function journal(): Promise<DurableExecutionJournal> {
  const root = await mkdtemp(join(tmpdir(), "outcomeguard-journal-"));
  roots.push(root);
  const value = new DurableExecutionJournal(root, signer);
  await value.initialize();
  await value.acquireSignerLock();
  return value;
}

afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("durable execution journal", () => {
  it("keys one-time execution by the signed mandate rather than mutable bundle metadata", () => {
    const mandateDigest = hash("d");
    const first = { createdAt: "2026-08-31T00:00:00.000Z", authorizedReceipt: { authorization: { mandateDigest } } } as ExecutionBundle;
    const laterCopy = { createdAt: "2026-08-31T00:00:01.000Z", authorizedReceipt: { authorization: { mandateDigest } } } as ExecutionBundle;
    expect(executionJobId(first)).toBe(mandateDigest);
    expect(executionJobId(laterCopy)).toBe(mandateDigest);
  });

  it("hash-chains serialized events and verifies them after restart", async () => {
    const first = await journal();
    await first.append({ event: "JOB_ACCEPTED", jobId: hash("a"), signer, chainId: 50312, authorizationDigest: hash("b"), orderFingerprint: hash("c") });
    await first.append({ event: "PREFLIGHT_PASSED", jobId: hash("a"), signer, chainId: 50312, authorizationDigest: hash("b"), orderFingerprint: hash("c") });
    const root = first.root;
    await first.releaseSignerLock();
    const restarted = new DurableExecutionJournal(root, signer);
    await restarted.initialize();
    expect(restarted.snapshot()).toHaveLength(2);
    expect(restarted.snapshot()[1]?.previousEventHash).toBe(restarted.snapshot()[0]?.eventHash);
  });

  it("allows only one process lock and requires explicit stale-lock recovery", async () => {
    const first = await journal();
    const second = new DurableExecutionJournal(first.root, signer);
    await second.initialize();
    await expect(second.acquireSignerLock()).rejects.toThrow(/signer lock already exists/);
    await first.releaseSignerLock();
  });

  it("fails closed on journal tampering and torn writes", async () => {
    const first = await journal();
    await first.append({ event: "JOB_ACCEPTED", jobId: hash("a"), signer, chainId: 50312, authorizationDigest: hash("b"), orderFingerprint: hash("c") });
    await first.releaseSignerLock();
    const original = await readFile(first.journalPath, "utf8");
    await writeFile(first.journalPath, original.replace("JOB_ACCEPTED", "TX_BROADCAST"), "utf8");
    await expect(new DurableExecutionJournal(first.root, signer).initialize()).rejects.toThrow(/digest is corrupt/);
    await writeFile(first.journalPath, original.trimEnd(), "utf8");
    await expect(new DurableExecutionJournal(first.root, signer).initialize()).rejects.toThrow(/torn final record/);
  });

  it("serializes concurrent state transitions without duplicate sequences", async () => {
    const value = await journal();
    await Promise.all(Array.from({ length: 25 }, (_, index) => value.append({
      event: "PREFLIGHT_PASSED", jobId: hash("a"), signer, chainId: 50312,
      authorizationDigest: hash("b"), orderFingerprint: hash("c"), detail: `check-${index}`
    })));
    expect(value.snapshot().map(({ sequence }) => sequence)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    await value.releaseSignerLock();
  });

  it("rejects relative state paths", () => {
    expect(() => new DurableExecutionJournal("./state", signer)).toThrow(/absolute path/);
  });
});
