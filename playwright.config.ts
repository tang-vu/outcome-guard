import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3187", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-390", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } }
  ],
  webServer: { command: "npm run start -w @outcome-guard/web -- --port 3187", url: "http://127.0.0.1:3187/api/health", reuseExistingServer: false, timeout: 120_000 }
});
