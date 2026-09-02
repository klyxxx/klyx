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

const quotesPayload = {
  quotes: [
    {
      id: "quote-priority-e2e-1",
      title: "Nettoyage appartement",
      description: "Nettoyage complet avant état des lieux.",
      requested_date: "2026-09-05",
      requested_time: "10:00:00",
      duration_hours: 3,
      pricing_type: "fixed",
      estimated_total: 120,
      provider_price: null,
      provider_message: null,
      status: "requested",
      created_at: "2026-09-02T18:00:00.000Z",
      client: {
        id: "quote-client-e2e-1",
        first_name: "Client",
        last_name: "KLYX",
      },
    },
    {
      id: "quote-history-e2e-2",
      title: "Ancien devis KLYX",
      description: "Demande déjà traitée.",
      requested_date: "2026-08-28",
      requested_time: "09:00:00",
      duration_hours: 2,
      pricing_type: "fixed",
      estimated_total: 80,
      provider_price: 80,
      provider_message: "Devis envoyé au client.",
      status: "sent",
      created_at: "2026-08-27T12:00:00.000Z",
      client: {
        id: "quote-client-e2e-2",
        first_name: "Autre",
        last_name: "Client",
      },
    },
  ],
};

test.describe("KLYX provider Quotes destination", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps one quote focused on desktop and mobile without accidental mutations", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    let mutationRequests = 0;
    await page.route("**/api/quotes", async (route) => {
      if (route.request().method() !== "GET") {
        mutationRequests += 1;
        await route.abort();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(quotesPayload),
      });
    });

    await page.route("**/api/provider/quotes/draft", async (route) => {
      mutationRequests += 1;
      await route.abort();
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/provider/quotes", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('[data-quote-priority="true"]')).toBeVisible();
    await expect(page.getByText("Nettoyage appartement")).toBeVisible();
    await expect(page.getByText("Ancien devis KLYX")).toBeHidden();
    await expect(page.locator("main .shadow-sm")).toHaveCount(0);

    const otherQuotes = page.locator("details").first();
    await otherQuotes.locator("summary").click();
    await expect(page.getByText("Ancien devis KLYX")).toBeVisible();
    await otherQuotes.locator("summary").click();
    await expect(page.getByText("Ancien devis KLYX")).toBeHidden();

    await attachViewport(page, testInfo, "provider-quotes-focused-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-navigation")).toBeVisible();
    await expect(page.getByText("Nettoyage appartement")).toBeVisible();
    await expect(page.getByText("Ancien devis KLYX")).toBeHidden();
    await attachViewport(page, testInfo, "provider-quotes-focused-mobile");

    expect(mutationRequests).toBe(0);
  });
});
