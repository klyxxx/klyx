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

async function mockActivity(page: Page) {
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
      body: JSON.stringify({
        missions: [],
        childBookingIds: [],
      }),
    });
  });
}

test.describe("KLYX Activity destination visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);

    try {
      await activateKlyxE2EProfile(page, "client");
    } catch {
      // Best-effort reset for the dedicated E2E account after a failed assertion.
    }
  });

  test("keeps Activity calm with one obvious next action", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await mockActivity(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/bookings", { waitUntil: "domcontentloaded" });

    const nextAction = page
      .getByRole("main")
      .locator('a[href="/bookings/e2e-action"]');
    await expect(nextAction).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigation principale KLYX" })
    ).toBeVisible();

    await expect(
      page
        .getByRole("main")
        .locator('[class*="violet"], [class*="indigo"], [class*="gradient"]')
    ).toHaveCount(0);

    await attachViewport(page, testInfo, "client-activity-calm-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nextAction).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navigation mobile KLYX" })
    ).toBeVisible();

    await attachViewport(page, testInfo, "client-activity-calm-mobile");
  });
});
