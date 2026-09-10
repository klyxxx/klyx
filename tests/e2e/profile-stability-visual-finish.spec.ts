import { expect, test, type Page } from "@playwright/test";
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

async function expectDocumentLockedToViewport(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(
    metrics.viewportHeight + 2
  );
}

async function expandProfileEditor(page: Page) {
  const toggle = page
    .getByRole("main")
    .locator('button[aria-expanded]')
    .first();

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#firstName")).toBeVisible();
}

test.describe("KLYX profile viewport stability", () => {
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

  test("keeps profile scrolling independent from the shell on desktop and mobile", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expectAssistantFirstDesktopShell(page, "/assistant");
    await expect(page.getByTestId("profile-summary-card")).toBeVisible();

    const desktopRail = page.getByTestId("desktop-mission-rail");
    const desktopRailBefore = await desktopRail.boundingBox();
    expect(desktopRailBefore).not.toBeNull();

    await expandProfileEditor(page);
    await expectDocumentLockedToViewport(page);

    const desktopScrollRegion = page.getByTestId("profile-scroll-region");
    const desktopMetrics = await desktopScrollRegion.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(desktopMetrics.overflowY).toBe("auto");
    expect(desktopMetrics.scrollHeight).toBeGreaterThan(
      desktopMetrics.clientHeight
    );

    await desktopScrollRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => desktopScrollRegion.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    const desktopRailAfter = await desktopRail.boundingBox();
    expect(desktopRailAfter).not.toBeNull();
    expect(Math.abs(desktopRailAfter!.y - desktopRailBefore!.y)).toBeLessThanOrEqual(
      1
    );
    expect(
      Math.abs(desktopRailAfter!.height - desktopRailBefore!.height)
    ).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expectAssistantFirstMobileShell(page);
    await expect(page.getByTestId("profile-summary-card")).toBeVisible();
    await expandProfileEditor(page);
    await expectDocumentLockedToViewport(page);

    const mobileScrollRegion = page.getByTestId("profile-scroll-region");
    const mobileMetrics = await mobileScrollRegion.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
      viewportHeight: window.innerHeight,
    }));
    expect(mobileMetrics.overflowY).toBe("auto");
    expect(
      Math.abs(mobileMetrics.clientHeight - (mobileMetrics.viewportHeight - 56))
    ).toBeLessThanOrEqual(2);
    expect(mobileMetrics.scrollHeight).toBeGreaterThan(mobileMetrics.clientHeight);

    await mobileScrollRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => mobileScrollRegion.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    const mobileHeader = page.getByTestId("assistant-shell-mobile-header");
    const mobileHeaderBox = await mobileHeader.boundingBox();
    expect(mobileHeaderBox).not.toBeNull();
    expect(Math.abs(mobileHeaderBox!.y)).toBeLessThanOrEqual(1);
  });
});
