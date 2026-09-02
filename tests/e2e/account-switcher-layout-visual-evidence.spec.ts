import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

async function attachViewport(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
}

function expectSameGeometry(
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number }
) {
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
}

test.describe("KLYX profile switcher stable layout", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("provider sidebar never moves and mobile controls stay fixed", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    const desktopSidebar = page.getByTestId("desktop-sidebar");
    const desktopNavigation = page.getByTestId("desktop-navigation");
    const trigger = page
      .locator(
        '[data-testid="desktop-sidebar"] [data-testid="account-switcher"] button[aria-haspopup="menu"]:not([disabled])'
      )
      .last();

    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await expect(desktopSidebar).toBeVisible();
    await expect(desktopNavigation).toBeVisible();

    const sidebarBefore = await desktopSidebar.boundingBox();
    const navigationBefore = await desktopNavigation.boundingBox();
    const triggerBefore = await trigger.boundingBox();
    expect(sidebarBefore).not.toBeNull();
    expect(navigationBefore).not.toBeNull();
    expect(triggerBefore).not.toBeNull();

    await trigger.click();

    const menu = page
      .locator(
        '[data-testid="desktop-sidebar"] [data-testid="account-switcher"] [role="menu"][aria-label="Changer de profil KLYX"]'
      )
      .last();
    await expect(menu).toBeVisible();

    const navigationAfter = await desktopNavigation.boundingBox();
    const triggerAfter = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    expect(navigationAfter).not.toBeNull();
    expect(triggerAfter).not.toBeNull();
    expect(menuBox).not.toBeNull();

    expectSameGeometry(navigationBefore!, navigationAfter!);
    expectSameGeometry(triggerBefore!, triggerAfter!);
    expect(menuBox!.x).toBeCloseTo(triggerAfter!.x, 0);
    expect(menuBox!.width).toBeCloseTo(triggerAfter!.width, 0);

    await attachViewport(page, testInfo, "provider-account-switcher-open-stable-desktop");

    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      document.body.style.minHeight = "2200px";
      window.scrollTo(0, 700);
    });

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const sidebarAfterScroll = await desktopSidebar.boundingBox();
    expect(sidebarAfterScroll).not.toBeNull();
    expectSameGeometry(sidebarBefore!, sidebarAfterScroll!);
    expect(sidebarAfterScroll!.y).toBeCloseTo(0, 0);
    expect(sidebarAfterScroll!.height).toBeCloseTo(900, 0);

    await attachViewport(page, testInfo, "provider-sidebar-fixed-after-scroll");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileNavigation = page.getByTestId("mobile-navigation");
    await expect(mobileNavigation).toBeVisible();

    const mobileBefore = await mobileNavigation.boundingBox();
    expect(mobileBefore).not.toBeNull();

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    const mobileAfter = await mobileNavigation.boundingBox();
    expect(mobileAfter).not.toBeNull();
    expectSameGeometry(mobileBefore!, mobileAfter!);
    expect(mobileAfter!.y + mobileAfter!.height).toBeLessThanOrEqual(844.5);

    await attachViewport(page, testInfo, "provider-mobile-navigation-fixed-after-scroll");
  });
});
