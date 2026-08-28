import { expect, test } from "@playwright/test";
import publishedReceipt from "../../docs/evidence/pre-execution-receipt.json";

const publishedReceiptDigest = publishedReceipt.integrity.digest;

test("judge can compose and inspect bounded protection", async ({ page }) => {
  await page.route("**/api/markets", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ source: "unavailable", error: "deterministic E2E fixture" }) }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Turn a downside concern/ })).toBeVisible();
  await expect(page.getByText("Deterministic fallback")).toBeVisible();
  await expect(page.getByText(/LIVE READ EVIDENCE/)).toBeVisible();
  await expect(page.locator(".digest")).toContainText(/^0x[0-9a-f]{64}$/);
  await page.getByLabel("Exposure value").fill("1250");
  await expect(page.getByText(/Protect my \$1,250\.00 ETH exposure/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Scenario loss reduced/ })).toBeVisible();
  await expect(page.getByText("Basis risk is real.")).toBeVisible();
  await expect(page.getByText("PRE-EXECUTION")).toBeVisible();
  await expect(page.locator(".digest")).toContainText(/^0x[0-9a-f]{64}$/);
  await expect(page.getByText(/VERIFIED REPLAY/)).toBeVisible();
  await expect(page.locator(".settledReplay")).toContainText("NO / DOWN");
  await expect(page.locator(".settledReplay")).toContainText("No fabricated ownership or redemption");
});

test("truth labels, policy drill-down, receipt inspection, and mobile width remain safe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/markets", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ source: "unavailable", error: "deterministic E2E fixture" }) }));
  await page.goto("/");
  await expect(page.getByText("FIXTURE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Derive live plan first/ })).toBeDisabled();
  await page.getByRole("button", { name: /Inspect all 22 checks/ }).click();
  await expect(page.locator(".policyGrid details")).toHaveCount(22);
  await page.getByRole("button", { name: /Inspect raw JSON/ }).click();
  await expect(page.locator(".rawReceipt")).toContainText('"schemaVersion": "1.0.0"');
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.locator(".alert")).toContainText("No injected wallet found");
  const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, offenders: [...document.querySelectorAll<HTMLElement>("body *")].filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 5).map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })) }));
  expect(layout.overflow, JSON.stringify(layout.offenders)).toBeLessThanOrEqual(1);
  const transition = await page.locator(".card").first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transition)).toBeLessThanOrEqual(0.00001);
});

test("health identifies network and honest mode", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ ok: true, chainId: 50312, network: "somnia-shannon" });
  const replay = await request.get("/api/replay");
  expect(replay.ok()).toBe(true);
  await expect(replay.json()).resolves.toMatchObject({ label: "VERIFIED_REPLAY", terminalState: { status: "Resolved", winningOutcome: "NO" }, redemptionEvidence: { status: "NOT_PERFORMED" }, verification: { valid: true } });
});

test("receipt explorer verifies, discloses lifecycle truth, and serves the artifact", async ({ page, request }) => {
  await page.goto(`/receipts/${publishedReceiptDigest}`);
  await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Protection objective" })).toBeVisible();
  await expect(page.getByText(/This artifact proves planning and policy evaluation only/)).toBeVisible();
  await expect(page.getByText("NOT SUBMITTED", { exact: false })).toBeVisible();
  await expect(page.locator(".explorerPolicies details[open]")).toHaveCount(3);

  const artifact = await request.get(`/api/receipts/${publishedReceiptDigest}?download=1`);
  expect(artifact.ok()).toBe(true);
  expect(artifact.headers()["content-disposition"]).toContain("attachment");
  await expect(artifact.json()).resolves.toMatchObject({ lifecycleStage: "PRE_EXECUTION", integrity: { digest: publishedReceiptDigest }, execution: { status: "NOT_SUBMITTED" } });
});

test("unknown receipt digests fail closed", async ({ page, request }) => {
  const unknown = `0x${"0".repeat(64)}`;
  await page.goto(`/receipts/${unknown}`);
  await expect(page.getByRole("heading", { name: "Receipt not found." })).toBeVisible();
  await expect(page.getByText("FAIL CLOSED", { exact: true })).toBeVisible();
  expect((await request.get(`/api/receipts/${unknown}`)).status()).toBe(404);
});
