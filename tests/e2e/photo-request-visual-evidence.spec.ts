import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

const SYNTHETIC_PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAoAAAAFoCAMAAADw7LpjAAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAA9klEQVR42u3BMQEAAADCoPVPbQsvoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgZ4WVAAFYOwxKAAAAAElFTkSuQmCC",
  "base64"
);

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({
      fullPage: true,
      animations: "disabled",
    }),
    contentType: "image/png",
  });
}

async function openPhotoRequest(page: Page) {
  await page.goto("/request/photo", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Montre-moi ce qu’il faut faire." })
  ).toBeVisible();
}

async function addSyntheticPhoto(page: Page) {
  await page
    .locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles({
      name: "klyx-safe-visual-fixture.png",
      mimeType: "image/png",
      buffer: SYNTHETIC_PHOTO,
    });
  await expect(page.getByAltText("Aperçu du problème")).toBeVisible();
  await page.getByLabel("Explique le besoin").fill(
    "Une fuite synthétique sous un évier pour vérifier seulement le rendu visuel KLYX."
  );

  const visionConsent = page.getByRole("checkbox");
  if (!(await visionConsent.isChecked())) {
    await page
      .getByText("Autoriser l’analyse visuelle IA de cette photo", { exact: true })
      .click();
  }
  await expect(visionConsent).toBeChecked();

  const submit = page.locator('button[type="submit"]');
  await expect(submit).toBeEnabled();
  await expect(submit).toContainText("Utiliser et analyser avec KLYX");
}

test.describe("KLYX photo request visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("archives safe desktop and mobile media states", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPhotoRequest(page);
    await attachScreenshot(page, testInfo, "photo-request-empty-desktop");
    await addSyntheticPhoto(page);
    await attachScreenshot(page, testInfo, "photo-request-preview-desktop");

    await page.getByRole("button", { name: "Supprimer la photo" }).click();
    await expect(page.getByText("Ajouter une photo", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await attachScreenshot(page, testInfo, "photo-request-empty-mobile");
    await addSyntheticPhoto(page);
    await attachScreenshot(page, testInfo, "photo-request-preview-mobile");
  });
});
