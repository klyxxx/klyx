import { expect, test } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";
import {
  expectAssistantFirstDesktopShell,
  expectAssistantFirstMobileShell,
  openAssistantFirstMobileDrawer,
} from "./helpers/assistant-shell";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("KLYX strict role navigation", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("client desktop centers the Assistant and keeps one bottom account menu", async ({
    page,
  }) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant");

    await expectAssistantFirstDesktopShell(page, "/assistant");

    const rail = page.getByTestId("desktop-mission-rail");
    await expect(rail.getByTestId("new-mission-action")).toBeVisible();
    const history = rail.getByTestId("mission-history");
    await expect(history).toBeVisible();
    await expect(history).not.toHaveAttribute("open", "");
    await expect(rail.getByTestId("mission-history-detail")).toBeHidden();
    await expect(rail.getByText("Messages", { exact: true })).toHaveCount(0);
    await expect(rail.getByRole("navigation")).toHaveCount(0);

    const accountEntry = rail.getByTestId("account-entry");
    await expect(accountEntry).toBeVisible();
    await accountEntry.click();
    const accountMenu = rail.getByTestId("account-menu");
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu.locator('a[href="/profile"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/settings"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/support"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/messages"]')).toHaveCount(0);
    expect(await accountMenu.getByTestId("account-profile-option").count()).toBeGreaterThanOrEqual(2);

    const entryBox = await accountEntry.boundingBox();
    const menuBox = await accountMenu.boundingBox();
    expect(entryBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.bottom).toBeLessThanOrEqual(entryBox!.top + 2);
  });

  test("provider desktop keeps service navigation outside the account menu", async ({
    page,
  }) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");
    await page.goto("/provider/assistant");

    await expectAssistantFirstDesktopShell(page, "/provider/assistant");

    const rail = page.getByTestId("desktop-mission-rail");
    await expect(rail.getByRole("navigation")).toHaveCount(0);

    await rail.getByTestId("account-entry").click();
    const accountMenu = rail.getByTestId("account-menu");
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu.locator('a[href="/provider/studio"]')).toHaveCount(0);
    await expect(accountMenu.locator('a[href="/provider/payments"]')).toHaveCount(0);
    await expect(accountMenu.locator('a[href="/profile"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/settings"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/support"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/messages"]')).toHaveCount(0);
  });

  test("mobile uses a header and drawer with the same bottom account menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant");

    await expectAssistantFirstMobileShell(page);

    const trigger = page.getByTestId("assistant-shell-mobile-menu");
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(triggerBox!.height).toBeGreaterThanOrEqual(40);
    expect(triggerBox!.width).toBeGreaterThanOrEqual(40);

    const drawer = await openAssistantFirstMobileDrawer(page, "/assistant");
    const rail = drawer.getByTestId("mobile-mission-rail");
    await expect(rail.getByTestId("new-mission-action")).toBeVisible();
    const history = rail.getByTestId("mission-history");
    await expect(history).toBeVisible();
    await expect(history).not.toHaveAttribute("open", "");
    await expect(rail.getByTestId("mission-history-detail")).toBeHidden();

    await rail.getByTestId("account-entry").click();
    const accountMenu = rail.getByTestId("account-menu");
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu.locator('a[href="/profile"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/settings"]')).toBeVisible();
    await expect(accountMenu.locator('a[href="/support"]')).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(accountMenu).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });
});
