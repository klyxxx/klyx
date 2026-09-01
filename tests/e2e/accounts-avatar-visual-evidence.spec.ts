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

const SYNTHETIC_AVATAR = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
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

async function expectAccounts(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Mes profils", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Une connexion, jusqu’à cinq profils")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ajouter un profil", exact: true })
  ).toBeVisible();
}

test.describe("KLYX accounts avatar visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("archives the simplified profiles landing, editor and create dialog", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/accounts", { waitUntil: "domcontentloaded" });
    await expectAccounts(page);
    await attachScreenshot(page, testInfo, "accounts-profiles-desktop");

    await page
      .getByRole("button", { name: "Modifier", exact: true })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "klyx-safe-avatar-fixture.png",
      mimeType: "image/png",
      buffer: SYNTHETIC_AVATAR,
    });
    await expect(
      dialog.getByAltText("Aperçu du profil", { exact: true })
    ).toBeVisible();
    await attachScreenshot(page, testInfo, "accounts-avatar-preview-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await attachScreenshot(page, testInfo, "accounts-avatar-preview-mobile");

    await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(dialog).toBeHidden();
    await attachScreenshot(page, testInfo, "accounts-profiles-mobile");

    await page
      .getByRole("button", { name: "Ajouter un profil", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Client/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Prestataire/ })).toBeVisible();
    await attachScreenshot(page, testInfo, "accounts-create-profile-mobile");

    await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(dialog).toBeHidden();
  });
});
