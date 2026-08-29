import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const localBaseUrl = "http://127.0.0.1:3100";
const baseURL = externalBaseUrl || localBaseUrl;

const useSystemChrome = process.env.KLYX_PLAYWRIGHT_SYSTEM_CHROME === "1";
const localServerCommand = process.env.CI
  ? "npm run start -- --hostname 127.0.0.1 --port 3100"
  : "npm run dev -- --hostname 127.0.0.1 --port 3100";

const sharedAuthState = path.join(
  process.cwd(),
  "test-results",
  ".auth",
  "klyx-e2e.json"
);

const sharedAuthSpecs =
  /authenticated-(?:client-surfaces|provider-surfaces|session-boundaries)\.spec\.ts/;

const chromeUse = {
  ...devices["Desktop Chrome"],
  ...(useSystemChrome ? { channel: "chrome" as const } : {}),
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,

  expect: {
    timeout: 15_000,
  },

  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "playwright-report",
      },
    ],
  ],

  use: {
    baseURL,
    locale: "fr-BE",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: externalBaseUrl
    ? undefined
    : {
        // CI already validates `npm run build` before Playwright.
        // Reuse that exact production build instead of recompiling routes
        // through `next dev`; local E2E keeps the dev server.
        command: localServerCommand,
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },

  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      retries: 0,
      use: chromeUse,
    },
    {
      // Public/anonymous coverage plus the explicit multi-profile login test.
      // Keeping the latter here preserves one real login UI verification.
      name: "chromium",
      testIgnore: sharedAuthSpecs,
      use: chromeUse,
    },
    {
      // Read-heavy authenticated suites reuse one Supabase browser session
      // instead of repeatedly calling signInWithPassword on the same account.
      name: "chromium-authenticated",
      testMatch: sharedAuthSpecs,
      dependencies: ["auth-setup"],
      use: {
        ...chromeUse,
        storageState: sharedAuthState,
      },
    },
  ],
});
