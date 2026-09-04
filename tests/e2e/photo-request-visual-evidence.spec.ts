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
  "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",
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
  await page.locator('input[type="file"]').setInputFiles({
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
  await expect(submit).toContainText("Analyser avec KLYX");
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
