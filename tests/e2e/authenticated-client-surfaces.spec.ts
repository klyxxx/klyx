import { expect, test } from "@playwright/test";
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

  test("client pages complete their authenticated API reads", async ({ page }) => {
    test.setTimeout(120_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    const bookingsResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/bookings/overview"
    );
    await page.goto("/bookings");
    const bookingsResponse = await bookingsResponsePromise;
    expect(bookingsResponse.status()).toBe(200);
    expect(await bookingsResponse.json()).toBeTruthy();

    const coverageResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/search/coverage"
    );
    await page.goto("/coverage");
    const coverageResponse = await coverageResponsePromise;
    expect(coverageResponse.status()).toBe(200);

    const coverageBody = await coverageResponse.json();
    expect(Array.isArray(coverageBody?.services)).toBe(true);
    expect(Array.isArray(coverageBody?.providers)).toBe(true);
  });
});
