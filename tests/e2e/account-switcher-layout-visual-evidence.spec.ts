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
  openAssistantFirstMobileDrawer,
} from "./helpers/assistant-shell";

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

function expectSameHorizontalGeometry(
  before: { x: number; y: number; width: number; height: number },
  after: { x: number; y: number; width: number; height: number }
) {
  expect(after.x).toBeCloseTo(before.x, 0);
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

  test("provider mission rail keeps stable dimensions and mobile header stays fixed", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expectAssistantFirstDesktopShell(page, "/provider/assistant");

    const desktopRail = page.getByTestId("desktop-mission-rail");
    const trigger = desktopRail
      .locator(
        '[data-testid="account-switcher"] button[aria-haspopup="menu"]:not([disabled])'
      )
      .last();

    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();

    const railBefore = await desktopRail.boundingBox();
    const triggerBefore = await trigger.boundingBox();
    expect(railBefore).not.toBeNull();
    expect(triggerBefore).not.toBeNull();

    await trigger.click();

    const menu = desktopRail
      .locator(
        '[data-testid="account-switcher"] [role="menu"][aria-label="Changer de profil KLYX"]'
      )
      .last();
    await expect(menu).toBeVisible();

    const railAfter = await desktopRail.boundingBox();
    const triggerAfter = await trigger.boundingBox();
    const menuBox = await menu.boundingBox();
    expect(railAfter).not.toBeNull();
    expect(triggerAfter).not.toBeNull();
    expect(menuBox).not.toBeNull();

    expectSameGeometry(railBefore!, railAfter!);
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

    const railAfterScroll = await desktopRail.boundingBox();
    expect(railAfterScroll).not.toBeNull();
    expectSameHorizontalGeometry(railBefore!, railAfterScroll!);
    expect(railAfterScroll!.width).toBeGreaterThanOrEqual(240);
    expect(railAfterScroll!.width).toBeLessThanOrEqual(264);
    expect(railAfterScroll!.height).toBeCloseTo(900, 0);

    await attachViewport(page, testInfo, "provider-mission-rail-dimensions-stable-after-scroll");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectAssistantFirstMobileShell(page);

    const mobileHeader = page.getByTestId("assistant-shell-mobile-header");
    const mobileBefore = await mobileHeader.boundingBox();
    expect(mobileBefore).not.toBeNull();

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    const mobileAfter = await mobileHeader.boundingBox();
    expect(mobileAfter).not.toBeNull();
    expectSameGeometry(mobileBefore!, mobileAfter!);
    expect(mobileAfter!.y).toBeCloseTo(0, 0);

    const drawer = await openAssistantFirstMobileDrawer(page, "/provider/assistant");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");

    await attachViewport(page, testInfo, "provider-mobile-header-fixed-after-scroll");
  });
});
