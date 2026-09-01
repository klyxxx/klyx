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

function disclosureButtons(page: Page) {
  return page.getByRole("main").locator('button[aria-expanded]');
}

test.describe("KLYX Profile → Settings destination visual evidence", () => {
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

  test("keeps destinations calm by revealing details only on demand", async ({
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

    const profileEditorToggle = disclosureButtons(page).first();
    await expect(profileEditorToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#firstName")).toHaveCount(0);

    await attachViewport(page, testInfo, "client-profile-calm-desktop");

    await profileEditorToggle.click();
    await expect(profileEditorToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#firstName")).toBeVisible();
    await attachViewport(page, testInfo, "client-profile-editor-expanded-desktop");

    await profileEditorToggle.click();
    await expect(page.locator("#firstName")).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectAboveMobileNavigation(page);
    await attachViewport(page, testInfo, "client-profile-calm-mobile");

    await clientSettingsLink.click();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);

    const settingsBackLink = page
      .getByRole("main")
      .locator('a[href="/profile"]');
    await expect(settingsBackLink).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile KLYX" })
    ).toBeVisible();

    const clientPanels = disclosureButtons(page);
    await expect(clientPanels.first()).toHaveAttribute("aria-expanded", "false");
    await attachViewport(page, testInfo, "client-settings-calm-mobile");

    await clientPanels.nth(1).click();
    await expect(clientPanels.nth(1)).toHaveAttribute("aria-expanded", "true");
    await attachViewport(page, testInfo, "client-settings-appearance-expanded-mobile");
    await clientPanels.nth(1).click();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();
    await attachViewport(page, testInfo, "client-settings-calm-desktop");

    await activateKlyxE2EProfile(page, "provider");
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const providerSettingsLink = page
      .getByRole("main")
      .locator('a[href="/settings"]');
    await expect(providerSettingsLink).toBeVisible();
    await expect(
      page.getByRole("main").locator('a[href="/provider"]')
    ).toBeVisible();

    await attachViewport(page, testInfo, "provider-profile-calm-desktop");

    await providerSettingsLink.click();
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);

    const providerPaymentLink = page
      .getByRole("main")
      .locator('a[href="/provider/payments"]');
    await expect(providerPaymentLink).toHaveCount(0);

    const providerPanels = disclosureButtons(page);
    await providerPanels.nth(2).click();
    await expect(providerPaymentLink).toBeVisible();
    await attachViewport(page, testInfo, "provider-settings-payments-expanded-desktop");

    await activateKlyxE2EProfile(page, "client");
  });
});
