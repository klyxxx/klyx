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

async function expectAboveMobileNavigation(page: Page) {
  const profileLink = page.getByRole("main").locator('a[href="/profile"]');
  const mobileNavigation = page.getByRole("navigation", {
    name: "Navigation mobile KLYX",
  });

  await profileLink.scrollIntoViewIfNeeded();
  await expect(profileLink).toBeInViewport();
  await expect(mobileNavigation).toBeVisible();

  const [profileBox, navigationBox] = await Promise.all([
    profileLink.boundingBox(),
    mobileNavigation.boundingBox(),
  ]);

  expect(profileBox, "Provider profile link must have a measurable mobile box").not.toBeNull();
  expect(navigationBox, "Mobile navigation must have a measurable box").not.toBeNull();
  expect(
    profileBox!.y + profileBox!.height,
    "Provider Services content must stay fully above the fixed mobile navigation"
  ).toBeLessThanOrEqual(navigationBox!.y);
}

test.describe("KLYX provider Services visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
    try {
      await activateKlyxE2EProfile(page, "client");
    } catch {
      // Best-effort reset for the dedicated E2E account.
    }
  });

  test("keeps provider navigation frozen and renders Services as a focused single-blue surface", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/provider/studio", { waitUntil: "domcontentloaded" });

    const heading = page.getByRole("heading", {
      name: "Configurer mes services",
      level: 1,
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Rechercher un service à proposer" })).toBeVisible();

    await attachViewport(page, testInfo, "provider-services-desktop");

    const publishButton = page.getByRole("button", {
      name: /Publier ma fiche|Mettre à jour la fiche/,
    });
    await publishButton.scrollIntoViewIfNeeded();
    await expect(publishButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer le brouillon" })).toBeVisible();

    await attachViewport(page, testInfo, "provider-services-publication-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await heading.scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile KLYX" })
    ).toBeVisible();
    await attachViewport(page, testInfo, "provider-services-mobile");

    await expectAboveMobileNavigation(page);
    await attachViewport(page, testInfo, "provider-services-mobile-bottom");
  });
});
