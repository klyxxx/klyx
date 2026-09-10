import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBaseUrl = "http://127.0.0.1:3200";
const baseURL = externalBaseUrl || localBaseUrl;
const useSystemChrome = process.env.KLYX_PLAYWRIGHT_SYSTEM_CHROME === "1";

const localServerCommand = process.env.CI
  ? "npm run start -- --hostname 127.0.0.1 --port 3200"
  : "npm run dev -- --hostname 127.0.0.1 --port 3200";

export default defineConfig({
  testDir: "./tests/ux-visual",
  outputDir: "ux-visual-results",
  snapshotDir: "./tests/ux-visual/__screenshots__",
  snapshotPathTemplate:
    "{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.03,
      threshold: 0.2,
    },
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "ux-visual-report",
      },
    ],
    [
      "json",
      {
        outputFile: "ux-visual-results/results.json",
      },
    ],
  ],
  use: {
    baseURL,
    locale: "fr-BE",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: localServerCommand,
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...(useSystemChrome ? { channel: "chrome" } : {}),
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        ...(useSystemChrome ? { channel: "chrome" } : {}),
      },
    },
  ],
});
