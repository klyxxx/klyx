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

  test("provider jobs page completes its authenticated API read", async ({ page }) => {
    test.setTimeout(120_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    const jobsResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/provider/jobs" &&
        response.request().method() === "GET"
      );
    });

    const documentResponse = await page.goto("/provider/jobs", {
      waitUntil: "domcontentloaded",
    });

    expect(documentResponse, "provider jobs page returned no document response").toBeTruthy();
    expect(
      documentResponse!.status(),
      "provider jobs page returned an HTTP error"
    ).toBeLessThan(400);

    const jobsResponse = await jobsResponsePromise;
    const jobsBody = (await jobsResponse.json().catch(() => null)) as
      | { role?: string; requests?: unknown[]; error?: string }
      | null;

    expect(
      jobsResponse.status(),
      `provider jobs API failed: ${JSON.stringify(jobsBody)}`
    ).toBe(200);
    expect(jobsBody).toBeTruthy();
    expect(jobsBody?.role).toBe("provider");
    expect(Array.isArray(jobsBody?.requests)).toBe(true);
  });
});
