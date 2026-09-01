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

test.describe("KLYX Profile → Settings visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps the frozen navigation and exposes Settings from Profile", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await mockPhoneReads(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const settingsLink = page.locator('a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();

    await attachViewport(page, testInfo, "profile-settings-entry-desktop");

    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expect(page.locator('a[href="/profile"]')).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(3);

    await attachViewport(page, testInfo, "settings-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile KLYX" })
    ).toBeVisible();
    await expect(page.locator('a[href="/profile"]')).toBeInViewport();

    await attachViewport(page, testInfo, "settings-mobile");
  });
});
