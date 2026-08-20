import { test } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  expectHealthyPrivateRoute,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("KLYX authenticated provider surfaces", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("provider workspace, money, verification and trust surfaces stay healthy", async ({ page }) => {
    test.setTimeout(240_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    for (const route of [
      "/provider",
      "/provider/jobs",
      "/provider/payments",
      "/provider/planning",
      "/provider/quotes",
      "/provider/services/new",
      "/provider/skills",
      "/provider/trust",
      "/provider/verification",
      "/provider/zones",
      "/connect",
      "/scores",
      "/security",
    ] as const) {
      await expectHealthyPrivateRoute(page, route);
    }
  });
});
