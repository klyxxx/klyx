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

async function attachViewport(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
}

test.describe("KLYX legacy provider Assistant destination", () => {
  test.skip(!hasE2ECredentials, "Dedicated KLYX E2E credentials are not configured.");

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("converges provider compatibility navigation to the unified conversation-first assistant", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    let providerAssistantRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/provider/assistant") {
        providerAssistantRequests += 1;
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/provider/assistant", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/assistant(?:\?|$)/);
    await expectAssistantFirstDesktopShell(page, "/assistant");
    await expect(
      page.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Demander à KLYX…")).toBeVisible();
    await expect(page.getByText("Brouillons à vérifier")).toHaveCount(0);

    await attachViewport(page, testInfo, "unified-assistant-from-provider-legacy-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectAssistantFirstMobileShell(page);
    await expect(
      page.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();

    await attachViewport(page, testInfo, "unified-assistant-from-provider-legacy-mobile");

    expect(providerAssistantRequests).toBe(0);
  });
});
