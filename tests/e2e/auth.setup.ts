import fs from "node:fs";
import path from "node:path";

import { test as setup } from "@playwright/test";

import {
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

export const KLYX_E2E_AUTH_STATE_PATH = path.join(
  process.cwd(),
  "test-results",
  ".auth",
  "klyx-e2e.json"
);

setup.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

setup("prepare dedicated KLYX E2E authenticated state", async ({ page }) => {
  fs.mkdirSync(path.dirname(KLYX_E2E_AUTH_STATE_PATH), { recursive: true });

  if (hasE2ECredentials) {
    await loginKlyxE2E(page);
  }

  // test-results/ is gitignored and is never uploaded by the CI artifact step.
  // The state contains Supabase session material, never the E2E password.
  await page.context().storageState({ path: KLYX_E2E_AUTH_STATE_PATH });
});
