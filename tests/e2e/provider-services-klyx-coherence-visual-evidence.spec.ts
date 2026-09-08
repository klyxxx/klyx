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

async function expectMobileContentUnobstructed(page: Page) {
  const profileLink = page.getByRole("main").locator('a[href="/profile"]');
  await profileLink.scrollIntoViewIfNeeded();
  await expect(profileLink).toBeInViewport();
  await expectAssistantFirstMobileShell(page);

  const box = await profileLink.boundingBox();
  expect(box, "Provider profile link must have a measurable mobile box").not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
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
    } catch {}
  });

  test("keeps Services secondary and renders a focused single-blue surface", async ({
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
    await expectAssistantFirstDesktopShell(page, "/provider/assistant");
    await expect(
      page.getByRole("searchbox", { name: "Rechercher un service à proposer" })
    ).toBeVisible();

    await attachViewport(page, testInfo, "provider-services-desktop");

    const publishButton = page.getByRole("button", {
      name: /Publier ma fiche|Mettre à jour la fiche/,
    });
    await publishButton.scrollIntoViewIfNeeded();
    await expect(publishButton).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enregistrer le brouillon" })
    ).toBeVisible();

    await attachViewport(page, testInfo, "provider-services-publication-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await heading.scrollIntoViewIfNeeded();
    await expectAssistantFirstMobileShell(page);
    await attachViewport(page, testInfo, "provider-services-mobile");

    await expectMobileContentUnobstructed(page);
    await attachViewport(page, testInfo, "provider-services-mobile-bottom");
  });
});
