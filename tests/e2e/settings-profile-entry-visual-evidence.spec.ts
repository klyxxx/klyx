import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";
import {
  expectAssistantFirstDesktopShell,
  expectAssistantFirstMobileShell,
} from "./helpers/assistant-shell";

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

async function expectProfileShortcutsRemoved(page: Page) {
  const main = page.getByRole("main");
  await expect(main.locator('a[href="/settings"]')).toHaveCount(0);
  await expect(main.locator('a[href="/provider"]')).toHaveCount(0);
}

function disclosureButtons(page: Page) {
  return page.getByRole("main").locator('button[aria-expanded]');
}

function settingsPanel(page: Page, key: string) {
  return page
    .getByRole("main")
    .locator(`button[data-settings-panel="${key}"]`);
}

test.describe("KLYX Profile and Settings destination visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
    try {
      await activateKlyxE2EProfile(page, "client");
    } catch {}
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
    await expectAssistantFirstDesktopShell(page, "/assistant");
    await expectProfileShortcutsRemoved(page);

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
    await expectProfileShortcutsRemoved(page);
    await expectAssistantFirstMobileShell(page);
    await attachViewport(page, testInfo, "client-profile-calm-mobile");

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);
    await expectAssistantFirstMobileShell(page);

    const settingsBackLink = page
      .getByRole("main")
      .locator('a[href="/profile"]');
    await expect(settingsBackLink).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);

    const phonePanel = settingsPanel(page, "phone");
    const languagePanel = settingsPanel(page, "language");
    const authPanel = settingsPanel(page, "auth");
    const otherPanel = settingsPanel(page, "other");

    await expect(phonePanel).toBeVisible();
    await expect(languagePanel).toBeVisible();
    await expect(authPanel).toBeVisible();
    await expect(otherPanel).toBeVisible();
    await expect(phonePanel).toHaveAttribute("aria-expanded", "false");
    await expect(languagePanel).toHaveAttribute("aria-expanded", "false");
    await expect(authPanel).toHaveAttribute("aria-expanded", "false");
    await expect(otherPanel).toHaveAttribute("aria-expanded", "false");

    await expect(settingsPanel(page, "appearance")).toHaveCount(0);
    await expect(settingsPanel(page, "notifications")).toHaveCount(0);
    await expect(settingsPanel(page, "privacy")).toHaveCount(0);
    await expect(settingsPanel(page, "delete")).toHaveCount(0);

    await attachViewport(page, testInfo, "client-settings-calm-mobile");

    await otherPanel.click();
    await expect(otherPanel).toHaveAttribute("aria-expanded", "true");

    const appearancePanel = settingsPanel(page, "appearance");
    await expect(appearancePanel).toBeVisible();
    await expect(settingsPanel(page, "notifications")).toBeVisible();
    await expect(settingsPanel(page, "privacy")).toBeVisible();
    await expect(settingsPanel(page, "delete")).toBeVisible();

    await appearancePanel.click();
    await expect(appearancePanel).toHaveAttribute("aria-expanded", "true");
    await attachViewport(page, testInfo, "client-settings-appearance-expanded-mobile");
    await appearancePanel.click();

    await otherPanel.click();
    await expect(otherPanel).toHaveAttribute("aria-expanded", "false");
    await expect(settingsPanel(page, "appearance")).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expectAssistantFirstDesktopShell(page, "/assistant");
    await attachViewport(page, testInfo, "client-settings-calm-desktop");

    await activateKlyxE2EProfile(page, "provider");
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expectAssistantFirstDesktopShell(page, "/provider/assistant");
    await expectProfileShortcutsRemoved(page);

    await attachViewport(page, testInfo, "provider-profile-calm-desktop");

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings(?:\?|$)/);

    const providerPaymentLink = page
      .getByRole("main")
      .locator('a[href="/provider/payments"]');
    await expect(providerPaymentLink).toHaveCount(0);
    await expect(settingsPanel(page, "payments")).toHaveCount(0);

    const providerOtherPanel = settingsPanel(page, "other");
    await providerOtherPanel.click();
    await expect(providerOtherPanel).toHaveAttribute("aria-expanded", "true");

    const providerPaymentsPanel = settingsPanel(page, "payments");
    await expect(providerPaymentsPanel).toBeVisible();
    await providerPaymentsPanel.click();
    await expect(providerPaymentLink).toBeVisible();
    await attachViewport(page, testInfo, "provider-settings-payments-expanded-desktop");

    await activateKlyxE2EProfile(page, "client");
  });
});
