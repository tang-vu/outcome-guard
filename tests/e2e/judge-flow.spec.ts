import { expect, test } from "@playwright/test";

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
