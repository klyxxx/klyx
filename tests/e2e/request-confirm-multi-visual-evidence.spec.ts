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

const VISUAL_SCHEDULE = JSON.stringify({
  multiSlot: true,
  slots: [
    {
      date: "2026-09-05",
      startTime: "09:00",
      endTime: "12:00",
      budget: 75,
      durationHours: 3,
    },
    {
      date: "2026-09-06",
      startTime: "14:00",
      endTime: "17:30",
      budget: 90,
      durationHours: 3.5,
    },
  ],
});

function confirmationRoute() {
  const params = new URLSearchParams({
    conversationId: "klyx-visual-conversation",
    confirmationId: "klyx-visual-confirmation",
    service: "babysitting",
    city: "Bruxelles",
    schedule: VISUAL_SCHEDULE,
  });

  return `/request/confirm-multi?${params.toString()}`;
}

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

async function expectConfirmation(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Vérifie tous les créneaux" })
  ).toBeVisible();
  await expect(page.getByText("Créneau 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Créneau 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publier cette demande groupée" })
  ).toBeEnabled();
}

test.describe("KLYX multi-request confirmation visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("archives desktop and mobile confirmation states", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(confirmationRoute(), { waitUntil: "domcontentloaded" });
    await expectConfirmation(page);
    await attachScreenshot(
      page,
      testInfo,
      "request-confirm-multi-desktop"
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(confirmationRoute(), { waitUntil: "domcontentloaded" });
    await expectConfirmation(page);
    await attachScreenshot(
      page,
      testInfo,
      "request-confirm-multi-mobile"
    );
  });
});
