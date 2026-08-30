/* global process, setInterval, clearInterval */
import { readdir, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const inbox = path.resolve(process.argv[2] ?? "");
if (!path.isAbsolute(inbox)) throw new Error("Signed-bundle inbox must be an absolute path");
await stat(inbox).then((value) => { if (!value.isDirectory()) throw new Error("Signed-bundle inbox is not a directory"); });

const startedAt = Date.now();
const processed = new Set();
let child;
let busy = false;
let stopping = false;

const log = (event, fields = {}) => process.stdout.write(`${JSON.stringify({ event, ...fields, at: new Date().toISOString() })}\n`);
log("SIGNED_BUNDLE_WATCH_STARTED", { inbox });

async function scan() {
  if (busy || stopping) return;
  const entries = await readdir(inbox, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^outcomeguard-.*\.json$/i.test(entry.name)) continue;
    const file = path.join(inbox, entry.name);
    if (processed.has(file)) continue;
    const details = await stat(file);
    if (details.mtimeMs <= startedAt || Date.now() - details.mtimeMs < 250) continue;
    candidates.push({ file, name: entry.name, mtimeMs: details.mtimeMs });
  }
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const candidate = candidates[0];
  if (!candidate) return;
  processed.add(candidate.file);
  try {
    const bundle = JSON.parse(await readFile(candidate.file, "utf8"));
    const deadlineMs = Date.parse(bundle?.mandate?.authorizationDeadline);
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      log("SIGNED_BUNDLE_SKIPPED", { file: candidate.name, reason: "missing-or-expired-deadline" });
      return;
    }
    busy = true;
    log("SIGNED_BUNDLE_DETECTED", { file: candidate.name, deadline: new Date(deadlineMs).toISOString() });
    child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(process.cwd(), "scripts", "run-secure-worker.ps1"), "-Bundle", candidate.file, "-InitialTotalPremiumAtRisk", "0"], { cwd: process.cwd(), stdio: "inherit", windowsHide: true });
    child.once("exit", (code, signal) => { log("SIGNED_BUNDLE_WORKER_EXITED", { file: candidate.name, code, signal }); child = undefined; busy = false; });
    child.once("error", (error) => { log("SIGNED_BUNDLE_WORKER_ERROR", { file: candidate.name, reason: error.message }); child = undefined; busy = false; });
  } catch (error) {
    log("SIGNED_BUNDLE_REJECTED", { file: candidate.name, reason: error instanceof Error ? error.message : String(error) });
  }
}

const timer = setInterval(() => { void scan().catch((error) => log("SIGNED_BUNDLE_SCAN_ERROR", { reason: error instanceof Error ? error.message : String(error) })); }, 250);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    clearInterval(timer);
    if (child) child.kill(signal);
    else process.exit(0);
  });
}
