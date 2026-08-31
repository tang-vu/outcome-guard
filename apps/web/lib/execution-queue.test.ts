import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecutionBundle } from "@outcome-guard/schemas";
import { afterEach, describe, expect, it } from "vitest";
import { enqueueExecutionBundle, executionIdFor, readExecutionStatus } from "./execution-queue";

const roots: string[] = [];
const previousInbox = process.env.EXECUTION_INBOX_DIR;
const previousStatuses = process.env.EXECUTION_STATUS_DIR;
const digest = `0x${"a".repeat(64)}` as `0x${string}`;
const bundle = { authorizedReceipt: { authorization: { mandateDigest: digest } } } as ExecutionBundle;

afterEach(async () => {
  if (previousInbox === undefined) delete process.env.EXECUTION_INBOX_DIR; else process.env.EXECUTION_INBOX_DIR = previousInbox;
  if (previousStatuses === undefined) delete process.env.EXECUTION_STATUS_DIR; else process.env.EXECUTION_STATUS_DIR = previousStatuses;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function configureQueue(): Promise<{ inbox: string; statuses: string }> {
  const root = await mkdtemp(join(tmpdir(), "outcomeguard-queue-"));
  roots.push(root);
  const inbox = join(root, "inbox");
  const statuses = join(root, "statuses");
  process.env.EXECUTION_INBOX_DIR = inbox;
  process.env.EXECUTION_STATUS_DIR = statuses;
  return { inbox, statuses };
}

describe("automatic execution queue", () => {
  it("atomically queues a mandate and exposes only its public state", async () => {
    const { inbox } = await configureQueue();
    const queued = await enqueueExecutionBundle(bundle);
    expect(queued).toEqual({ executionId: digest, statusUrl: `/api/executions/${digest}` });
    expect(executionIdFor(bundle)).toBe(digest);
    expect(await readExecutionStatus(digest)).toMatchObject({ executionId: digest, state: "QUEUED" });
    expect(JSON.parse(await readFile(join(inbox, `outcomeguard-${digest.slice(2)}.json`), "utf8"))).toMatchObject(bundle);
  });

  it("refuses a second enqueue of the same signed mandate", async () => {
    await configureQueue();
    await enqueueExecutionBundle(bundle);
    await expect(enqueueExecutionBundle(bundle)).rejects.toThrow(/replay refused/);
  });

  it("fails closed when queue paths are not absolute", async () => {
    process.env.EXECUTION_INBOX_DIR = "relative/inbox";
    process.env.EXECUTION_STATUS_DIR = "relative/status";
    await expect(enqueueExecutionBundle(bundle)).rejects.toThrow(/absolute path/);
  });
});
