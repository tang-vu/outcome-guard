/* global process, URL, fetch, AbortSignal, Buffer */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const configPath = path.join(projectRoot, "docs/demo/video/narration.json");
const outputDirectory = path.join(projectRoot, "docs/demo/video/audio");
const reportPath = path.join(projectRoot, "docs/demo/video/asr-report.json");
const apiKey = process.env.MIMO_API_KEY;
const configuredBaseUrl = process.env.MIMO_BASE_URL ?? "https://token-plan-sgp.xiaomimimo.com/v1";

if (!apiKey) throw new Error("MIMO_API_KEY is required through the secure PowerShell runner.");
const apiBase = new URL(configuredBaseUrl);
if (apiBase.protocol !== "https:" || !apiBase.hostname.endsWith("xiaomimimo.com")) {
  throw new Error("MIMO_BASE_URL must be an HTTPS xiaomimimo.com endpoint.");
}

const config = JSON.parse(await readFile(configPath, "utf8"));
await mkdir(outputDirectory, { recursive: true });

async function completion(payload) {
  const response = await fetch(new URL(`${apiBase.pathname.replace(/\/$/, "")}/chat/completions`, apiBase.origin), {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok) throw new Error(`MiMo API request failed with HTTP ${response.status}.`);
  return response.json();
}

function audioData(response) {
  const data = response?.choices?.[0]?.message?.audio?.data;
  if (typeof data !== "string" || data.length < 100) throw new Error("MiMo TTS response did not contain audio data.");
  return Buffer.from(data, "base64");
}

function transcriptText(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((item) => item?.text ?? "").join(" ").trim();
  throw new Error("MiMo ASR response did not contain a transcript.");
}

function words(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
}

function wordErrorRate(expected, actual) {
  const left = words(expected);
  const right = words(actual);
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return left.length === 0 ? 0 : previous[right.length] / left.length;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr?.trim() || "unknown error"}`);
  return result.stdout.trim();
}

const report = {
  generatedAt: new Date().toISOString(),
  ttsModel: "mimo-v2.5-tts",
  asrModel: "mimo-v2.5-asr",
  voice: process.env.MIMO_VOICE ?? config.voice,
  apiHost: apiBase.hostname,
  segments: []
};
const adjustedFiles = [];

for (const segment of config.segments) {
  process.stdout.write(`Generating ${segment.id}... `);
  const tts = await completion({
    model: "mimo-v2.5-tts",
    messages: [
      { role: "user", content: config.style },
      { role: "assistant", content: segment.text }
    ],
    audio: { format: "wav", voice: report.voice }
  });
  const rawFile = path.join(outputDirectory, `${segment.id}.wav`);
  await writeFile(rawFile, audioData(tts));

  const raw = await readFile(rawFile);
  if (raw.byteLength > 10_000_000) throw new Error(`${segment.id} exceeds MiMo ASR's 10 MB input limit.`);
  const asr = await completion({
    model: "mimo-v2.5-asr",
    messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: `data:audio/wav;base64,${raw.toString("base64")}` } }] }],
    asr_options: { language: "en" }
  });
  const transcript = transcriptText(asr);
  const errorRate = wordErrorRate(segment.text, transcript);

  const durationJson = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", rawFile]);
  const sourceDuration = Number(JSON.parse(durationJson).format.duration);
  const targetDuration = Number(segment.end) - Number(segment.start);
  const speechWindow = Math.max(1, targetDuration - 0.45);
  const tempo = sourceDuration / speechWindow;
  if (tempo < 0.5 || tempo > 2) throw new Error(`${segment.id} requires unsafe tempo ${tempo.toFixed(3)}. Edit the narration instead.`);

  const adjustedFile = path.join(outputDirectory, `${segment.id}-timed.wav`);
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", rawFile, "-af", `atempo=${tempo.toFixed(6)},apad,atrim=0:${targetDuration}`, "-ar", "48000", "-ac", "1", adjustedFile]);
  adjustedFiles.push(adjustedFile);
  report.segments.push({
    id: segment.id,
    expected: segment.text,
    transcript,
    wordErrorRate: Number(errorRate.toFixed(4)),
    sourceDurationSeconds: Number(sourceDuration.toFixed(3)),
    targetDurationSeconds: targetDuration,
    tempo: Number(tempo.toFixed(4)),
    qa: errorRate <= 0.18 ? "PASS" : "REVIEW"
  });
  process.stdout.write(`${errorRate <= 0.18 ? "PASS" : "REVIEW"} (WER ${(errorRate * 100).toFixed(1)}%)\n`);
}

const concatPath = path.join(outputDirectory, "concat.txt");
await writeFile(concatPath, adjustedFiles.map((file) => `file '${file.replaceAll("'", "'\\''").replaceAll("\\", "/")}'`).join("\n") + "\n", "utf8");
run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concatPath, "-af", "loudnorm=I=-16:LRA=7:TP=-1.5", "-ar", "48000", "-ac", "1", path.join(outputDirectory, "narration.wav")]);

report.overall = {
  status: report.segments.every((segment) => segment.qa === "PASS") ? "PASS" : "REVIEW",
  maximumWordErrorRate: Math.max(...report.segments.map((segment) => segment.wordErrorRate)),
  note: "ASR is a pronunciation QA signal, not ground truth. Review every segment marked REVIEW by ear before publication."
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`Narration: ${path.join(outputDirectory, "narration.wav")}\nASR QA: ${reportPath}\n`);
