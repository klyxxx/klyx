import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";

async function attachPublicScreenshot(
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

async function expectLogin(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: "Connexion à KLYX",
    })
  ).toBeVisible();
}

async function expectProviderSignup(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: "Commencer avec KLYX",
    })
  ).toBeVisible();
  await expect(
    page.getByText("Je rejoins KLYX comme prestataire", {
      exact: true,
    })
  ).toBeVisible();
}

async function expectResetPassword(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: "Nouveau mot de passe",
    })
  ).toBeVisible();
}

test.describe("KLYX public visual evidence", () => {
  test("archives safe desktop and mobile screenshots", async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name: "Que dois-je organiser pour vous ?",
      })
    ).toBeVisible();
    await attachPublicScreenshot(page, testInfo, "public-home-desktop");

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expectLogin(page);
    await attachPublicScreenshot(page, testInfo, "public-login-desktop");

    await page.goto("/signup?type=provider", { waitUntil: "domcontentloaded" });
    await expectProviderSignup(page);
    await attachPublicScreenshot(page, testInfo, "provider-signup-desktop");

    await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
    await expectResetPassword(page);
    await attachPublicScreenshot(page, testInfo, "reset-password-desktop");

    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name: "Que dois-je organiser pour vous ?",
      })
    ).toBeVisible();
    await attachPublicScreenshot(page, testInfo, "public-home-mobile");

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expectLogin(page);
    await attachPublicScreenshot(page, testInfo, "public-login-mobile");

    await page.goto("/signup?type=provider", { waitUntil: "domcontentloaded" });
    await expectProviderSignup(page);
    await attachPublicScreenshot(page, testInfo, "provider-signup-mobile");

    await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
    await expectResetPassword(page);
    await attachPublicScreenshot(page, testInfo, "reset-password-mobile");
  });
});
