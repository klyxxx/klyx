import {
  defineConfig,
  devices,
} from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBaseUrl = "http://127.0.0.1:3100";
const baseURL = externalBaseUrl || localBaseUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/pwa-mobile-accessibility.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "fr-BE",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: process.env.CI
          ? "npm run start -- --hostname 127.0.0.1 --port 3100"
          : "npm run dev -- --hostname 127.0.0.1 --port 3100",
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    {
      name: "android-chromium-pwa",
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "ios-webkit-pwa",
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
});
