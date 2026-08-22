import {
  defineConfig,
  devices,
} from "@playwright/test";

const externalBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL?.trim();

const localBaseUrl =
  "http://127.0.0.1:3100";

const baseURL =
  externalBaseUrl || localBaseUrl;

const useSystemChrome =
  process.env.KLYX_PLAYWRIGHT_SYSTEM_CHROME === "1";

const localServerCommand = process.env.CI
  ? "npm run start -- --hostname 127.0.0.1 --port 3100"
  : "npm run dev -- --hostname 127.0.0.1 --port 3100";

export default defineConfig({
  testDir: "./tests/e2e",

  fullyParallel: false,

  forbidOnly:
    Boolean(process.env.CI),

  retries:
    process.env.CI ? 2 : 0,

  workers:
    process.env.CI ? 1 : undefined,

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
        outputFolder:
          "playwright-report",
      },
    ],
  ],

  use: {
    baseURL,

    locale:
      "fr-BE",

    trace:
      "on-first-retry",

    screenshot:
      "only-on-failure",

    video:
      "retain-on-failure",
  },

  webServer: externalBaseUrl
    ? undefined
    : {
        // CI already validates `npm run build` before Playwright.
        // Reuse that exact production build instead of recompiling
        // routes through `next dev`; local E2E keeps the dev server.
        command:
          localServerCommand,

        url:
          localBaseUrl,

        reuseExistingServer:
          !process.env.CI,

        timeout:
          120_000,

        stdout:
          "pipe",

        stderr:
          "pipe",
      },

  projects: [
    {
      name:
        "chromium",

      use: {
        ...devices[
          "Desktop Chrome"
        ],

        ...(useSystemChrome
          ? { channel: "chrome" }
          : {}),
      },
    },
  ],
});
