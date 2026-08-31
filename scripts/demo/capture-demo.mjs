/* global process, window, document */
import { copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const outputDir = path.join(projectRoot, "docs/demo/video/render");
const baseUrl = process.env.OUTCOMEGUARD_DEMO_URL ?? "https://outcomeguard.tangvu.dev";
const receipt = JSON.parse(await readFile(path.join(projectRoot, "docs/evidence/redemption-campaign-eec6/redemption-receipt.json"), "utf8"));
const receiptUrl = `${baseUrl}/receipts/${receipt.integrity.digest}`;

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
  recordVideo: { dir: outputDir, size: { width: 1920, height: 1080 } }
});
const page = await context.newPage();
const video = page.video();

let startedAt = 0;
const waitUntil = async (seconds) => {
  const remaining = startedAt + seconds * 1000 - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining);
};
const scrollTo = async (selector, offset = -90) => {
  await page.locator(selector).first().evaluate((element, yOffset) => {
    const top = element.getBoundingClientRect().top + window.scrollY + Number(yOffset);
    window.scrollTo({ top, behavior: "smooth" });
  }, offset);
  await page.waitForTimeout(900);
};
const callout = async (label, detail, tone = "live") => {
  await page.evaluate(({ labelText, detailText, calloutTone }) => {
    document.querySelector("[data-outcomeguard-video-callout]")?.remove();
    const node = document.createElement("aside");
    node.dataset.outcomeguardVideoCallout = "true";
    node.innerHTML = `<b>${labelText}</b><span>${detailText}</span>`;
    Object.assign(node.style, {
      position: "fixed", left: "42px", bottom: "42px", zIndex: "2147483647",
      display: "grid", gap: "5px", maxWidth: "680px", padding: "15px 18px",
      borderRadius: "10px", border: `1px solid ${calloutTone === "proof" ? "#66d6ad" : "#99b7aa"}`,
      background: "rgba(8, 25, 21, 0.94)", color: "#f5fff9",
      boxShadow: "0 18px 55px rgba(0,0,0,.24)", fontFamily: "Arial, sans-serif"
    });
    const title = node.querySelector("b");
    const body = node.querySelector("span");
    Object.assign(title.style, { color: calloutTone === "proof" ? "#78e0b8" : "#d6fff0", fontSize: "12px", letterSpacing: ".12em" });
    Object.assign(body.style, { color: "#d4dfda", fontSize: "15px", lineHeight: "1.4" });
    document.body.appendChild(node);
  }, { labelText: label, detailText: detail, calloutTone: tone });
};

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate(() => document.documentElement.style.scrollBehavior = "smooth");
  await callout("OUTCOMEGUARD", "Portfolio-aware rolling protection · Shannon testnet 50312");
  startedAt = Date.now();
  await waitUntil(12);

  await page.getByLabel("Exposure value").fill("1000");
  await page.getByRole("button", { name: "1 hour", exact: true }).click();
  await page.getByLabel("Adverse move scenario").fill("2");
  await page.getByLabel("Slippage").fill("2");
  await page.getByLabel("Protection target").fill("75");
  await callout("USER INTENT", "Manual demo exposure · $1,000 ETH · 1 hour · premium ≤ 15 tUSDC · slippage ≤ 2%");
  await waitUntil(31);

  await scrollTo(".liveEvidence");
  await callout("LIVE DISCOVERY", "Real DreamDEX read · scoped venue · chain-reconciled status and parameters");
  await page.waitForTimeout(8_000);
  const derive = page.getByRole("button", { name: "Derive live plan", exact: true });
  if (await derive.isVisible()) {
    await derive.click();
    await page.getByText("LIVE-DERIVED", { exact: true }).waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  }
  await waitUntil(51);

  await scrollTo(".scenarios");
  await callout("DETERMINISTIC HEDGE", "The chart and receipt consume the same calculation object");
  await waitUntil(73);

  await scrollTo(".gate");
  const inspect = page.getByRole("button", { name: /Inspect all \d+ checks|Collapse evidence/ });
  if (await inspect.isVisible() && (await inspect.textContent())?.includes("Inspect")) await inspect.click();
  await callout("FAIL-CLOSED POLICY", "Unknown or changed execution inputs cannot reach the signer");
  await waitUntil(91);

  await scrollTo(".settledReplay");
  await callout("REAL SHANNON EXECUTION", "Dedicated test agent · bounded IOC · fill and position reconciled", "proof");
  await waitUntil(112);

  await page.goto(receiptUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await callout("CANONICAL RECEIPT", "RFC 8785 canonical JSON · SHA-256 · immutable linked lineage", "proof");
  await waitUntil(124);
  await scrollTo(".lifecycleCard");
  await waitUntil(132);

  await scrollTo(".integrityCard", -40);
  await callout("SETTLEMENT → CLAIM", "Resolved DOWN · 4.171 tUSDC redeemed · winning position = 0", "proof");
  await waitUntil(148);

  await page.evaluate(() => {
    document.querySelector("[data-outcomeguard-video-callout]")?.remove();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  await page.waitForTimeout(600);
  await callout("EXPOSURE → PROTECT → VERIFY", "Policy-bound protection for wallets and treasuries", "proof");
  await waitUntil(155);
} finally {
  await context.close();
  await browser.close();
}

const recordedPath = await video.path();
const finalPath = path.join(outputDir, "outcomeguard-demo-silent.webm");
if (path.resolve(recordedPath) !== path.resolve(finalPath)) {
  await copyFile(recordedPath, finalPath);
  await unlink(recordedPath);
}
process.stdout.write(`${finalPath}\n`);
