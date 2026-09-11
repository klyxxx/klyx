import { expect, test, type Page } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

type ViewportMetrics = {
  clientWidth: number;
  scrollWidth: number;
  bodyScrollWidth: number;
  innerWidth: number;
};

async function openPhotoRequest(page: Page) {
  await page.goto("/request/photo", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Montre-moi ce qu’il faut faire." })
  ).toBeVisible();

  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    window.scrollTo(0, 0);
  });
}

async function expectNoHorizontalOverflow(
  page: Page,
  label: "DESKTOP" | "MOBILE"
) {
  const metrics = await page.evaluate<ViewportMetrics>(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  console.log(`KLYX_PHOTO_VIEWPORT_${label}=${JSON.stringify(metrics)}`);

  expect.soft(
    metrics.scrollWidth,
    `${label}: /request/photo must not create horizontal document overflow`
  ).toBeLessThanOrEqual(metrics.clientWidth + 2);

  expect.soft(
    metrics.bodyScrollWidth,
    `${label}: /request/photo body must stay inside the viewport`
  ).toBeLessThanOrEqual(metrics.clientWidth + 2);
}

test.describe("KLYX photo request viewport containment", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("stays inside desktop and 390x844 mobile viewports", async ({ page }) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPhotoRequest(page);
    await expectNoHorizontalOverflow(page, "DESKTOP");

    await page.setViewportSize({ width: 390, height: 844 });
    await openPhotoRequest(page);
    await expectNoHorizontalOverflow(page, "MOBILE");

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Playwright viewport is unavailable");

    const header = page.getByTestId("assistant-shell-mobile-header");
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect.soft(
      headerBox!.x + headerBox!.width,
      "Mobile KLYX header must stay inside the viewport"
    ).toBeLessThanOrEqual(viewport.width + 1);

    const menu = page.getByTestId("assistant-shell-mobile-menu");
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect.soft(
      menuBox!.x + menuBox!.width,
      "Mobile KLYX menu button must stay inside the viewport"
    ).toBeLessThanOrEqual(viewport.width + 1);

    await menu.evaluate((element: HTMLElement) => element.click());
    const dialog = page.getByRole("dialog", { name: "KLYX" });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect.soft(
      dialogBox!.x + dialogBox!.width,
      "Mobile KLYX drawer must stay inside the viewport width"
    ).toBeLessThanOrEqual(viewport.width + 1);
    expect.soft(
      dialogBox!.y + dialogBox!.height,
      "Mobile KLYX drawer must stay inside the viewport height"
    ).toBeLessThanOrEqual(viewport.height + 1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const visionConsent = page.getByRole("checkbox", {
      name: /Autoriser l’analyse visuelle IA de cette photo/i,
    });
    await expect(visionConsent).toBeAttached();
    await expect(visionConsent).not.toBeChecked();
    await visionConsent.evaluate((element: HTMLInputElement) => element.click());
    await expect(visionConsent).toBeChecked();
  });
});
