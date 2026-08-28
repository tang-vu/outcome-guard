/* global console, process */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const patterns = [
  { name: "EVM private key assignment", re: /(?:PRIVATE_KEY|TAKER_PRIVATE_KEY)\s*=\s*0x[0-9a-fA-F]{64}/ },
  { name: "mnemonic phrase", re: /(?:mnemonic|seed phrase)\s*[:=]\s*["']?(?:[a-z]+\s+){11,23}[a-z]+/i },
  { name: "generic API secret", re: /(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_-]{24,}["']/i },
  { name: "GitHub token", re: /(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})/ },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "OpenAI-style key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "PEM private key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Bearer credential", re: /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/-]{20,}/i }
];
const findings = [];
for (const file of files) {
  if (/\.(png|jpe?g|gif|webp|ico|woff2?|pdf|lock)$/i.test(file)) continue;
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  patterns.forEach(({ name, re }) => { if (re.test(text)) findings.push({ file, pattern: name }); });
}

let history = "";
let commitsScanned = 0;
try {
  history = execFileSync("git", ["log", "--all", "--format=commit:%H", "--patch", "--no-ext-diff", "--no-textconv"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  commitsScanned = (history.match(/^commit:[0-9a-f]{40}$/gm) ?? []).length;
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: "Unable to scan git history", detail: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
}
patterns.forEach(({ name, re }) => { if (re.test(history)) findings.push({ scope: "git-history", pattern: name }); });
if (findings.length) { console.error(JSON.stringify({ ok: false, findings }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, scannedFiles: files.length, commitsScanned, scopes: ["working-tree", "all-git-history"], note: "Portable pattern scan passed; run Gitleaks as the independent final-release scanner." }));
