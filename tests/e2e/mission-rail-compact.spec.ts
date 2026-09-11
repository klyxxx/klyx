import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";
import {
  expectAssistantFirstDesktopShell,
  openAssistantFirstMobileDrawer,
} from "./helpers/assistant-shell";

const missionCards = [
  {
    id: "rail-action",
    entityType: "booking",
    href: "/bookings/rail-action",
    role: "client",
    otherUserName: "Prestataire A",
    serviceLabel: "Babysitting",
    statusLabel: "En attente",
    dateFrom: "2026-09-12",
    actionRequired: true,
    history: false,
    createdAt: "2026-09-11T18:00:00.000Z",
  },
  {
    id: "rail-upcoming-1",
    entityType: "booking",
    href: "/bookings/rail-upcoming-1",
    role: "client",
    otherUserName: "Prestataire B",
    serviceLabel: "Babysitting",
    statusLabel: "Acceptée",
    dateFrom: "2026-09-13",
    actionRequired: false,
    history: false,
    createdAt: "2026-09-11T17:00:00.000Z",
  },
  {
    id: "rail-upcoming-2",
    entityType: "booking",
    href: "/bookings/rail-upcoming-2",
    role: "client",
    otherUserName: "Prestataire C",
    serviceLabel: "Babysitting",
    statusLabel: "Acceptée",
    dateFrom: "2026-09-14",
    actionRequired: false,
    history: false,
    createdAt: "2026-09-11T16:00:00.000Z",
  },
  {
    id: "rail-upcoming-3",
    entityType: "booking",
    href: "/bookings/rail-upcoming-3",
    role: "client",
    otherUserName: "Prestataire D",
    serviceLabel: "Babysitting",
    statusLabel: "Confirmée",
    dateFrom: "2026-09-15",
    actionRequired: false,
    history: false,
    createdAt: "2026-09-11T15:00:00.000Z",
  },
  {
    id: "rail-history-1",
    entityType: "booking",
    href: "/bookings/rail-history-1",
    role: "client",
    otherUserName: "Prestataire E",
    serviceLabel: "Ménage",
    statusLabel: "Terminée",
    dateFrom: "2026-09-08",
    actionRequired: false,
    history: true,
    createdAt: "2026-09-08T12:00:00.000Z",
  },
  {
    id: "rail-history-2",
    entityType: "booking",
    href: "/bookings/rail-history-2",
    role: "client",
    otherUserName: "Prestataire F",
    serviceLabel: "Bricolage",
    statusLabel: "Annulée",
    dateFrom: "2026-09-07",
    actionRequired: false,
    history: true,
    createdAt: "2026-09-07T12:00:00.000Z",
  },
];

async function mockMissionRail(page: Page) {
  await page.route("**/api/bookings/overview", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accountType: "client", cards: missionCards }),
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
      body: JSON.stringify({ ok: true, hidden: [] }),
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
}

async function expectCompactRail(rail: Locator) {
  await expect(rail.getByTestId("new-mission-action")).toBeVisible();
  const plusBox = await rail.getByTestId("new-mission-action").boundingBox();
  expect(plusBox).not.toBeNull();
  expect(plusBox!.width).toBeLessThanOrEqual(42);
  expect(plusBox!.height).toBeLessThanOrEqual(42);

  const history = rail.getByTestId("mission-history");
  const detail = rail.getByTestId("mission-history-detail");
  await expect(history).toBeVisible();
  await expect(history).not.toHaveAttribute("open", "");
  await expect(detail).toBeHidden();

  await expect(rail.locator('[data-testid="mission-history-row"]:visible')).toHaveCount(1);
  await expect(rail.getByTestId("account-entry")).toHaveCount(1);

  await rail.getByTestId("mission-history-entry").click();
  await expect(history).toHaveAttribute("open", "");
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId("mission-history-row")).toHaveCount(missionCards.length);
}

async function attachRailScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
}

test.describe("KLYX compact MissionRail", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
    try {
      await activateKlyxE2EProfile(page, "client");
    } catch {}
  });

  test("keeps detailed mission history closed until opened on desktop and mobile", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await mockMissionRail(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/assistant", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("klyx:mission-rail:collapsed", "false"));
    await page.reload({ waitUntil: "domcontentloaded" });

    await expectAssistantFirstDesktopShell(page, "/assistant");
    const desktopRail = page.getByTestId("desktop-mission-rail");
    await expectCompactRail(desktopRail);
    await attachRailScreenshot(page, testInfo, "mission-rail-compact-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/assistant", { waitUntil: "domcontentloaded" });
    const dialog = await openAssistantFirstMobileDrawer(page, "/assistant");
    const mobileRail = dialog.getByTestId("mobile-mission-rail");
    await expectCompactRail(mobileRail);
    await attachRailScreenshot(page, testInfo, "mission-rail-compact-mobile");
  });
});
