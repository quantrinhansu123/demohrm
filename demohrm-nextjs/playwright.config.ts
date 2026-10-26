import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:3005",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "vi-VN",
    viewport: { width: 1440, height: 900 },
  },
  outputDir: "test-results",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3005/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
