import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/platform",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "reports/certification/all-platforms-playwright.json" }],
  ],
  use: {
    baseURL,
    locale: "fr-BE",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: "web-desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-web-chromium",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "ios-webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
