import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

async function attachViewport(
  page: Page,
  testInfo: TestInfo,
  name: string
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
}

async function mockPhoneReads(page: Page) {
  await page.route("**/api/profile/phone/access-history", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });

  await page.route("**/api/profile/phone/privacy", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        visibility: "transaction_participants",
        hasPhone: false,
        verified: false,
      }),
    });
  });

  await page.route("**/api/profile/phone", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        phoneNumber: null,
        verified: false,
        verifiedAt: null,
      }),
    });
  });
}

async function expectAboveMobileNavigation(page: Page) {
  const settingsLink = page.getByRole("main").locator('a[href="/settings"]');
  const mobileNavigation = page.getByRole("navigation", {
    name: "Navigation mobile KLYX",
  });

  await settingsLink.scrollIntoViewIfNeeded();
  await expect(settingsLink).toBeInViewport();
  await expect(mobileNavigation).toBeVisible();

  const [settingsBox, navigationBox] = await Promise.all([
    settingsLink.boundingBox(),
    mobileNavigation.boundingBox(),
  ]);

  expect(settingsBox, "Settings entry must have a measurable mobile box").not.toBeNull();
  expect(navigationBox, "Mobile navigation must have a measurable box").not.toBeNull();
  expect(
    settingsBox!.y + settingsBox!.height,
    "Settings entry must stay fully above the fixed mobile navigation"
  ).toBeLessThanOrEqual(navigationBox!.y);
}

test.describe("KLYX Profile → Settings visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);

    try {
      await activateKlyxE2EProfile(page, "client");
    } catch {
      // Best-effort reset for the dedicated E2E account after a failed assertion.
    }
  });

  test("keeps frozen navigation and exposes focused Settings for both roles", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await mockPhoneReads(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const clientSettingsLink = page
      .getByRole("main")
      .locator('a[href="/settings"]');
    await expect(clientSettingsLink).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();

    await attachViewport(page, testInfo, "client-profile-settings-entry-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectAboveMobileNavigation(page);
    await attachViewport(page, testInfo, "client-profile-settings-entry-mobile");

    await clientSettingsLink.click();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);

    const settingsBackLink = page
      .getByRole("main")
      .locator('a[href="/profile"]');
    await expect(settingsBackLink).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(3);
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile KLYX" })
    ).toBeVisible();
    await settingsBackLink.scrollIntoViewIfNeeded();
    await expect(settingsBackLink).toBeInViewport();

    await attachViewport(page, testInfo, "client-settings-mobile");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();
    await attachViewport(page, testInfo, "client-settings-desktop");

    await activateKlyxE2EProfile(page, "provider");
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const providerSettingsLink = page
      .getByRole("main")
      .locator('a[href="/settings"]');
    await expect(providerSettingsLink).toBeVisible();
    await expect(
      page.getByRole("main").locator('a[href="/provider"]')
    ).toBeVisible();

    await attachViewport(page, testInfo, "provider-profile-settings-entry-desktop");

    await providerSettingsLink.click();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expect(
      page.getByRole("main").locator('a[href="/provider/payments"]')
    ).toBeVisible();

    await attachViewport(page, testInfo, "provider-settings-desktop");

    await activateKlyxE2EProfile(page, "client");
  });
});
