import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";
import { settleVisualPage } from "./helpers/ux-certification";

function isMobileProject(testInfo: TestInfo) {
  return testInfo.project.name === "mobile-chromium";
}

async function forceDeterministicLocaleAndRail(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("klyx_language", "fr");
    localStorage.setItem("klyx:mission-rail:collapsed", "false");
    document.cookie = "klyx_locale=fr; Path=/; SameSite=Lax";
  });
}

async function mockDeterministicActiveMission(page: Page) {
  await page.route("**/api/bookings/overview", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accountType: "client",
        cards: [
          {
            id: "e2e-action",
            entityType: "booking",
            href: "/bookings/e2e-action",
            role: "client",
            otherUserName: "Prestataire KLYX",
            otherUserAvatar: null,
            serviceLabel: "Ménage",
            serviceSlug: "menage",
            status: "pending",
            statusLabel: "En attente",
            paymentStatus: "pending",
            amountCents: 6500,
            currency: "EUR",
            dateFrom: "2026-09-03",
            dateTo: "2026-09-03",
            firstStart: "09:00",
            lastEnd: "11:00",
            slotCount: 1,
            actionRequired: true,
            history: false,
            cancellationPending: false,
            refundStatus: "",
            createdAt: "2026-09-01T18:00:00.000Z",
          },
          {
            id: "e2e-upcoming",
            entityType: "booking",
            href: "/bookings/e2e-upcoming",
            role: "client",
            otherUserName: "Aide KLYX",
            otherUserAvatar: null,
            serviceLabel: "Bricolage",
            serviceSlug: "bricolage",
            status: "accepted",
            statusLabel: "Acceptée",
            paymentStatus: "paid",
            amountCents: 4800,
            currency: "EUR",
            dateFrom: "2026-09-06",
            dateTo: "2026-09-06",
            firstStart: "14:00",
            lastEnd: "15:30",
            slotCount: 1,
            actionRequired: false,
            history: false,
            cancellationPending: false,
            refundStatus: "",
            createdAt: "2026-09-01T17:00:00.000Z",
          },
        ],
        childBookingsHidden: 0,
        groupedDisplay: true,
      }),
    });
  });

  await page.route("**/api/bookings/split-missions", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ missions: [], childBookingIds: [] }),
    });
  });

  await page.route("**/api/bookings/activity-hidden", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        hidden: [],
        ownershipScope: "client",
        registryAvailable: true,
        sourceRecordsDeleted: false,
      }),
    });
  });
}

test.describe("temporary KLYX UX rebaseline capture", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("captures the current assistant reference without reading the old PNG", async ({
    page,
  }, testInfo) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await forceDeterministicLocaleAndRail(page);
    await mockDeterministicActiveMission(page);

    const response = await page.goto("/assistant", { waitUntil: "domcontentloaded" });
    expect(response).toBeTruthy();
    expect(response!.status()).toBeLessThan(400);
    await settleVisualPage(page);

    const masks = [
      page.locator('[data-testid="account-switcher"]'),
      page.locator('[data-testid="desktop-mission-rail"] section'),
      page.locator('[data-testid="mobile-mission-rail"] section'),
      page.locator("main time"),
      page.locator("main img"),
    ];

    await page.screenshot({
      path: `ux-rebaseline-results/assistant-${
        isMobileProject(testInfo) ? "mobile" : "desktop"
      }.png`,
      fullPage: false,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      mask: masks,
    });
  });
});
