/* global process, setInterval, clearInterval */
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const inbox = path.resolve(process.argv[2] ?? "");
const statusDirectory = path.resolve(process.argv[3] ?? "");
for (const [label, directory] of [["inbox", inbox], ["status directory", statusDirectory]]) {
  if (!path.isAbsolute(directory)) throw new Error(`Signed-bundle ${label} must be an absolute path`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await stat(directory).then((value) => { if (!value.isDirectory()) throw new Error(`Signed-bundle ${label} is not a directory`); });
}

const terminalStates = new Set(["FAILED", "RECONCILED", "RECOVERY_REQUIRED"]);
const processed = new Set();
let child;
let activeExecution;
let busy = false;
let stopping = false;

const log = (event, fields = {}) => process.stdout.write(`${JSON.stringify({ event, ...fields, at: new Date().toISOString() })}\n`);
const safeReason = (value) => String(value ?? "Unknown worker failure").slice(0, 500);
const statusPath = (executionId) => path.join(statusDirectory, `${executionId.slice(2).toLowerCase()}.json`);

async function readStatus(executionId) {
  try { return JSON.parse(await readFile(statusPath(executionId), "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return undefined; throw error; }
}

async function writeStatus(executionId, state, fields = {}) {
  const finalPath = statusPath(executionId);
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ executionId, state, updatedAt: new Date().toISOString(), ...fields })}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporaryPath, finalPath);
}

function parseWorkerResult(output) {
  for (const line of output.split(/\r?\n/).reverse()) {
    try {
      const value = JSON.parse(line);
      if (value?.status === "RECONCILED" || value?.status === "FAILED") return value;
    } catch { /* Non-JSON npm and PowerShell output is expected. */ }
  }
  return undefined;
}

log("SIGNED_BUNDLE_WATCH_STARTED", { inbox, statusDirectory });

async function runCandidate(candidate, bundle, executionId) {
  busy = true;
  activeExecution = executionId;
  await writeStatus(executionId, "PROCESSING", { stage: "PREFLIGHT" });
  log("SIGNED_BUNDLE_DETECTED", { file: candidate.name, executionId, deadline: new Date(Date.parse(bundle.mandate.authorizationDeadline)).toISOString() });
  let output = "";
  child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(process.cwd(), "scripts", "run-secure-worker.ps1"), "-Bundle", candidate.file, "-InitialTotalPremiumAtRisk", "0"], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { output = `${output}${chunk.toString()}`.slice(-64_000); });
  child.once("exit", async (code, signal) => {
    const result = parseWorkerResult(output);
    try {
      if (result?.status === "RECONCILED") {
        await writeStatus(executionId, "RECONCILED", { txHash: result.txHash, receiptDigest: result.receiptDigest, explorerUrl: result.explorerUrl });
      } else {
        await writeStatus(executionId, "FAILED", { error: safeReason(result?.error ?? `Worker exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`) });
      }
    } catch (error) { log("SIGNED_BUNDLE_STATUS_ERROR", { executionId, reason: safeReason(error?.message) }); }
    log("SIGNED_BUNDLE_WORKER_EXITED", { file: candidate.name, executionId, code, signal, status: result?.status ?? "UNKNOWN" });
    child = undefined; activeExecution = undefined; busy = false;
    if (stopping) process.exit(0);
  });
  child.once("error", async (error) => {
    await writeStatus(executionId, "FAILED", { error: safeReason(error.message) }).catch(() => undefined);
    log("SIGNED_BUNDLE_WORKER_ERROR", { file: candidate.name, executionId, reason: safeReason(error.message) });
    child = undefined; activeExecution = undefined; busy = false;
    if (stopping) process.exit(1);
  });
}

async function scan() {
  if (busy || stopping) return;
  const entries = await readdir(inbox, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^outcomeguard-[0-9a-f]{64}\.json$/i.test(entry.name)) continue;
    const file = path.join(inbox, entry.name);
    if (processed.has(file)) continue;
    const details = await stat(file);
    if (Date.now() - details.mtimeMs < 250) continue;
    candidates.push({ file, name: entry.name, mtimeMs: details.mtimeMs });
  }
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const candidate = candidates[0];
  if (!candidate) return;
  processed.add(candidate.file);
  try {
    const bundle = JSON.parse(await readFile(candidate.file, "utf8"));
    const executionId = bundle?.authorizedReceipt?.authorization?.mandateDigest;
    if (!/^0x[0-9a-fA-F]{64}$/.test(executionId ?? "")) throw new Error("Bundle has no valid mandate digest");
    const existing = await readStatus(executionId);
    if (existing?.state === "PROCESSING") {
      await writeStatus(executionId, "RECOVERY_REQUIRED", { error: "Watcher restarted while execution was in progress; manual chain reconciliation is required." });
      return;
    }
    if (terminalStates.has(existing?.state)) return;
    const deadlineMs = Date.parse(bundle?.mandate?.authorizationDeadline);
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      await writeStatus(executionId, "FAILED", { error: "Signed mandate expired before worker preflight." });
      log("SIGNED_BUNDLE_SKIPPED", { file: candidate.name, executionId, reason: "missing-or-expired-deadline" });
      return;
    }
    await runCandidate(candidate, bundle, executionId);
  } catch (error) {
    log("SIGNED_BUNDLE_REJECTED", { file: candidate.name, reason: safeReason(error?.message) });
  }
}

const timer = setInterval(() => { void scan().catch((error) => log("SIGNED_BUNDLE_SCAN_ERROR", { reason: safeReason(error?.message) })); }, 250);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    clearInterval(timer);
    if (child) {
      if (activeExecution) void writeStatus(activeExecution, "RECOVERY_REQUIRED", { error: "Execution worker was interrupted; reconcile chain state before retry." });
      child.kill(signal);
    } else process.exit(0);
  });
}
