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

async function mockProviderJobs(page: Page) {
  await page.route("**/api/provider/jobs", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        role: "provider",
        requests: [
          {
            id: "e2e-provider-primary",
            title: "Montage d’une armoire",
            description: "Assembler une armoire dans une chambre et vérifier les fixations.",
            city: "Bruxelles",
            requested_date: "2026-09-04",
            requested_time: "10:00",
            budget_max: 90,
            country_code: "BE",
            currency: "EUR",
            requestMode: "single",
            slotCount: 1,
            budgetTotal: null,
            preferSingleProvider: true,
            totalDurationMinutes: 120,
            slots: [],
            coverage: null,
            service: { name: "Bricolage", slug: "bricolage" },
            match: {
              score: 96,
              reasons: ["Zone compatible", "Créneau disponible", "Service correspondant"],
              locationMatch: true,
              availabilityMatch: true,
              budgetMatch: true,
            },
            myOffer: null,
          },
          {
            id: "e2e-provider-secondary",
            title: "Petite réparation intérieure",
            description: "Remettre en place une poignée et vérifier la fermeture.",
            city: "Bruxelles",
            requested_date: "2026-09-07",
            requested_time: "15:00",
            budget_max: 55,
            country_code: "BE",
            currency: "EUR",
            requestMode: "single",
            slotCount: 1,
            budgetTotal: null,
            preferSingleProvider: true,
            totalDurationMinutes: 60,
            slots: [],
            coverage: null,
            service: { name: "Bricolage", slug: "bricolage" },
            match: {
              score: 82,
              reasons: ["Zone compatible"],
              locationMatch: true,
              availabilityMatch: true,
              budgetMatch: true,
            },
            myOffer: {
              id: "e2e-offer",
              amount: 50,
              message: "Disponible pour cette mission.",
              status: "pending",
            },
          },
        ],
        count: 2,
        multiSlotAware: true,
        fullCoverageOnly: true,
        automaticExecutionAllowed: false,
      }),
    });
  });
}

test.describe("KLYX provider Missions destination visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);

    try {
      await activateKlyxE2EProfile(page, "client");
    } catch {
      // Best-effort reset after a failed assertion.
    }
  });

  test("keeps the best mission primary and reveals the offer only on request", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");
    await mockProviderJobs(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/provider/jobs", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();

    const offerToggles = page.getByRole("main").locator('button[aria-expanded]');
    await expect(offerToggles.first()).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("main").locator('input[type="number"]')).toHaveCount(0);
    await expect(
      page
        .getByRole("main")
        .locator('[class*="violet"], [class*="indigo"], [class*="gradient"]')
    ).toHaveCount(0);

    await attachViewport(page, testInfo, "provider-missions-calm-desktop");

    await offerToggles.first().click();
    await expect(offerToggles.first()).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("main").locator('input[type="number"]')).toBeVisible();
    await attachViewport(page, testInfo, "provider-mission-offer-expanded-desktop");

    await offerToggles.first().click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile KLYX" })
    ).toBeVisible();
    await expect(offerToggles.first()).toBeVisible();
    await attachViewport(page, testInfo, "provider-missions-calm-mobile");

    await activateKlyxE2EProfile(page, "client");
  });
});
