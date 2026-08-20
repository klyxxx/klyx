import { expect, test } from "@playwright/test";
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

  test("provider jobs API returns an authenticated read contract", async ({ page }) => {
    test.setTimeout(120_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    const result = await page.evaluate(async () => {
      const response = await fetch("/api/provider/jobs", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      return { status: response.status, body };
    });

    expect(result.status, `provider jobs failed: ${JSON.stringify(result.body)}`).toBe(200);
    expect(result.body).toBeTruthy();
    expect(result.body?.role).toBe("provider");
    expect(Array.isArray(result.body?.requests)).toBe(true);
  });
});
