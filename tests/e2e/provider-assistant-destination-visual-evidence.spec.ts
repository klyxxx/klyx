import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

async function attachViewport(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
}

const draftsPayload = {
  drafts: [
    {
      id: "assistant-draft-e2e-1",
      draft_type: "availability",
      title: "Disponibilité vendredi matin",
      payload: {
        dayLabel: "Vendredi",
        startTime: "09:00",
        endTime: "12:00",
      },
      status: "draft",
      created_at: "2026-09-02T08:30:00.000Z",
    },
  ],
};

test.describe("KLYX provider Assistant destination", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps the assistant conversation-first on desktop and mobile", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    let mutationRequests = 0;
    await page.route("**/api/provider/assistant", async (route) => {
      if (route.request().method() !== "GET") {
        mutationRequests += 1;
        await route.abort();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(draftsPayload),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/provider/assistant", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Que dois-je préparer pour ton activité ?" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Demander à KLYX…")).toBeVisible();

    const draftsSummary = page.locator("summary").filter({
      hasText: "Brouillons à vérifier",
    });
    await expect(draftsSummary).toBeVisible();
    await expect(draftsSummary).toContainText("1");
    await expect(page.getByText("Disponibilité vendredi matin")).toBeHidden();

    await draftsSummary.click();
    await expect(page.getByText("Disponibilité vendredi matin")).toBeVisible();
    await attachViewport(page, testInfo, "provider-assistant-focused-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-navigation")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Que dois-je préparer pour ton activité ?" })
    ).toBeVisible();
    await attachViewport(page, testInfo, "provider-assistant-focused-mobile");

    expect(mutationRequests).toBe(0);
  });
});
