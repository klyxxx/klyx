import { test } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  expectHealthyPrivateRoute,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("KLYX authenticated client surfaces", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("client core, discovery, assistant and trust surfaces stay healthy", async ({ page }) => {
    test.setTimeout(240_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    for (const route of [
      "/dashboard",
      "/search",
      "/coverage",
      "/requests",
      "/quotes",
      "/bookings",
      "/favorites",
      "/projects/new",
      "/memory",
      "/assistant",
      "/agent",
      "/brain",
      "/messages",
      "/notifications",
      "/security",
      "/settings",
      "/trust",
    ] as const) {
      await expectHealthyPrivateRoute(page, route);
    }
  });
});
