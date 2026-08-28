/* global console, process */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const patterns = [
  { name: "EVM private key assignment", re: /(?:PRIVATE_KEY|TAKER_PRIVATE_KEY)\s*=\s*0x[0-9a-fA-F]{64}/ },
  { name: "mnemonic phrase", re: /(?:mnemonic|seed phrase)\s*[:=]\s*["']?(?:[a-z]+\s+){11,23}[a-z]+/i },
  { name: "generic API secret", re: /(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_-]{24,}["']/i }
];
const findings = [];
for (const file of files) {
  if (/\.(png|jpe?g|gif|webp|ico|woff2?|pdf|lock)$/i.test(file)) continue;
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  patterns.forEach(({ name, re }) => { if (re.test(text)) findings.push({ file, pattern: name }); });
}
if (findings.length) { console.error(JSON.stringify({ ok: false, findings }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, scannedFiles: files.length, note: "Working-tree scanner; run gitleaks over full history before public release." }));
