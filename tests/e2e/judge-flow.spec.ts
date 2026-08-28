import { expect, test } from "@playwright/test";

test("judge can compose and inspect bounded protection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Turn a downside concern/ })).toBeVisible();
  await expect(page.getByText("Deterministic fallback")).toBeVisible();
  await expect(page.getByText("LIVE READ EVIDENCE · SEPARATE UNTIL SELECTED")).toBeVisible();
  await expect(page.locator(".digest")).toContainText(/^0x[0-9a-f]{64}$/);
  await page.getByLabel("Exposure value").fill("1250");
  await expect(page.getByText(/Protect my \$1,250\.00 ETH exposure/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Loss becomes bounded/ })).toBeVisible();
  await expect(page.getByText("Basis risk is real.")).toBeVisible();
  await expect(page.getByText("PRE-EXECUTION")).toBeVisible();
  await expect(page.locator(".digest")).toContainText(/^0x[0-9a-f]{64}$/);
});

test("health identifies network and honest mode", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ ok: true, chainId: 50312, network: "somnia-shannon" });
});
