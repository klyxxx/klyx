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

const planningPayload = {
  automaticChanges: false,
  planning: [
    {
      date: "2026-09-04",
      totalMinutes: 240,
      warnings: [
        {
          code: "short_break",
          severity: "warning",
          title: "Pause très courte",
          detail: "Deux missions sont très proches.",
          bookingIds: ["planning-booking-1", "planning-booking-2"],
        },
      ],
      bookings: [
        {
          id: "planning-booking-1",
          bookingDate: "2026-09-04",
          startTime: "09:00:00",
          endTime: "11:00:00",
          status: "accepted",
          serviceStatus: null,
          clientName: "Client KLYX",
        },
        {
          id: "planning-booking-2",
          bookingDate: "2026-09-04",
          startTime: "11:15:00",
          endTime: "13:15:00",
          status: "accepted",
          serviceStatus: null,
          clientName: "Client KLYX",
        },
      ],
    },
  ],
};

test.describe("KLYX provider Planning destination", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps planning readable on desktop and mobile without mutations", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    let mutationRequests = 0;
    await page.route("**/api/provider/planning?days=30", async (route) => {
      if (route.request().method() !== "GET") {
        mutationRequests += 1;
        await route.abort();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(planningPayload),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/provider/planning", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Client KLYX").first()).toBeVisible();
    await expect(page.locator('a[href="/bookings/planning-booking-1"]')).toBeVisible();
    await expect(page.locator(".shadow-sm")).toHaveCount(0);
    await attachViewport(page, testInfo, "provider-planning-focused-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-navigation")).toBeVisible();
    await expect(page.getByText("Client KLYX").first()).toBeVisible();
    await attachViewport(page, testInfo, "provider-planning-focused-mobile");

    expect(mutationRequests).toBe(0);
  });
});
