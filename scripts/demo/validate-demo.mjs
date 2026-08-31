/* global process */
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const config = JSON.parse(await readFile(path.join(projectRoot, "docs/demo/video/narration.json"), "utf8"));
const subtitle = await readFile(path.join(projectRoot, "docs/demo/video/outcomeguard-demo.srt"), "utf8");
const receipt = JSON.parse(await readFile(path.join(projectRoot, "docs/evidence/redemption-campaign-eec6/redemption-receipt.json"), "utf8"));
const errors = [];

if (config.targetDurationSeconds < 120 || config.targetDurationSeconds > 180) errors.push("Target runtime must be between two and three minutes.");
if (!Array.isArray(config.segments) || config.segments.length === 0) errors.push("Narration must contain segments.");
for (let index = 0; index < config.segments.length; index += 1) {
  const current = config.segments[index];
  const expectedStart = index === 0 ? 0 : config.segments[index - 1].end;
  if (current.start !== expectedStart) errors.push(`${current.id} starts at ${current.start}, expected ${expectedStart}.`);
  if (current.end <= current.start) errors.push(`${current.id} has a non-positive duration.`);
  if (!current.text?.trim()) errors.push(`${current.id} has no narration text.`);
}
const finalEnd = config.segments.at(-1)?.end;
if (finalEnd !== config.targetDurationSeconds) errors.push(`Narration ends at ${finalEnd}, expected ${config.targetDurationSeconds}.`);

const cueTimings = [...subtitle.matchAll(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})/g)];
if (cueTimings.length !== config.segments.length) errors.push(`Subtitle cue count ${cueTimings.length} does not match segment count ${config.segments.length}.`);
const subtitleEnd = cueTimings.at(-1)?.slice(5, 9).map(Number);
if (subtitleEnd) {
  const seconds = subtitleEnd[0] * 3600 + subtitleEnd[1] * 60 + subtitleEnd[2] + subtitleEnd[3] / 1000;
  if (seconds !== config.targetDurationSeconds) errors.push(`Subtitles end at ${seconds}, expected ${config.targetDurationSeconds}.`);
}

if (receipt.lifecycleStage !== "REDEMPTION") errors.push("Packaged judge receipt is not at redemption stage.");
if (receipt.settlement?.outcome !== "DOWN" || receipt.settlement?.claimable !== "4.171") errors.push("Packaged winning settlement facts changed.");
if (receipt.redemption?.amount !== "4.171" || !receipt.redemption?.txHash) errors.push("Packaged redemption evidence is incomplete.");
if (!/^0x[0-9a-f]{64}$/i.test(receipt.integrity?.digest ?? "")) errors.push("Packaged redemption digest is invalid.");

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ ok: true, durationSeconds: config.targetDurationSeconds, segments: config.segments.length, subtitleCues: cueTimings.length, receiptDigest: receipt.integrity.digest })}\n`);
}
