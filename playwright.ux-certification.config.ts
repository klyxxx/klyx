import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBaseUrl = "http://127.0.0.1:3100";
const baseURL = externalBaseUrl || localBaseUrl;

const localServerCommand = process.env.CI
  ? "npm run start -- --hostname 127.0.0.1 --port 3100"
  : "npm run dev -- --hostname 127.0.0.1 --port 3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/ux-assistant-first-certification.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.002,
    },
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "ux-playwright-report",
      },
    ],
    [
      "json",
      {
        outputFile: "ux-certification-report.json",
      },
    ],
  ],
  outputDir: "ux-test-results",
  snapshotPathTemplate:
    "{testDir}/ux-visual-certification-snapshots/{projectName}/{arg}{ext}",
  use: {
    baseURL,
    locale: "fr-BE",
    colorScheme: "dark",
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
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
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
