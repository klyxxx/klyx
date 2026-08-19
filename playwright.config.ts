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
        command:
          "npm run dev -- --hostname 127.0.0.1 --port 3100",

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