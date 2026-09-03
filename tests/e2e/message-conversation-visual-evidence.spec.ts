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

const BOOKING_ID = "00000000-0000-4000-8000-000000000474";
const OTHER_PROFILE_ID = "00000000-0000-4000-8000-000000000475";
const SENT_MESSAGE = "Message universel KLYX";

type SentMessage = {
  booking_id?: string;
  sender_id?: string;
  receiver_id?: string;
  message?: string;
  is_read?: boolean;
};

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = true
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({
      fullPage,
      animations: "disabled",
    }),
    contentType: "image/png",
  });
}

async function mockConversationReads(page: Page, activeProfileId: string) {
  const sentMessages: SentMessage[] = [];

  await page.route("**/rest/v1/bookings**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: BOOKING_ID,
        parent_id: activeProfileId,
        provider_id: OTHER_PROFILE_ID,
        babysitter_id: null,
        booking_date: "2026-09-12",
        start_time: "14:00:00",
        end_time: "16:00:00",
        status: "accepted",
      }),
    });
  });

  await page.route("**/rest/v1/profiles**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: OTHER_PROFILE_ID,
        full_name: "Prestataire KLYX",
        first_name: "Prestataire",
        last_name: "KLYX",
        avatar_url: null,
      }),
    });
  });

  await page.route("**/rest/v1/messages**", async (route) => {
    const method = route.request().method();

    if (method === "PATCH") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (method === "POST") {
      sentMessages.push(route.request().postDataJSON() as SentMessage);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    if (method !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "00000000-0000-4000-8000-000000000476",
          booking_id: BOOKING_ID,
          sender_id: OTHER_PROFILE_ID,
          receiver_id: activeProfileId,
          message: "Bonjour, votre créneau est bien prévu pour samedi.",
          is_read: true,
          created_at: "2026-09-01T13:05:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000477",
          booking_id: BOOKING_ID,
          sender_id: activeProfileId,
          receiver_id: OTHER_PROFILE_ID,
          message: "Parfait, merci. À samedi !",
          is_read: true,
          created_at: "2026-09-01T13:08:00.000Z",
        },
      ]),
    });
  });

  return sentMessages;
}

test.describe("KLYX message conversation visual evidence", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("archives a universal-provider conversation and sends to the canonical provider", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    const activeProfile = await activateKlyxE2EProfile(page, "client");
    const sentMessages = await mockConversationReads(page, activeProfile.id);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/messages/${BOOKING_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", { name: "Prestataire KLYX", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Bonjour, votre créneau est bien prévu pour samedi.")
    ).toBeVisible();
    await expect(page.getByText("Parfait, merci. À samedi !")).toBeVisible();

    const composer = page.getByRole("textbox");
    await expect(composer).toBeVisible();
    await composer.fill(SENT_MESSAGE);
    await composer.press("Enter");

    await expect.poll(() => sentMessages.length).toBe(1);
    expect(sentMessages[0]).toMatchObject({
      booking_id: BOOKING_ID,
      sender_id: activeProfile.id,
      receiver_id: OTHER_PROFILE_ID,
      message: SENT_MESSAGE,
      is_read: false,
    });

    await attachScreenshot(page, testInfo, "message-conversation-desktop");

    await page.setViewportSize({ width: 390, height: 844 });

    const mobileNavigation = page.getByRole("navigation", {
      name: "Navigation mobile KLYX",
    });

    await expect(composer).toBeInViewport();
    await expect(mobileNavigation).toBeVisible();

    const composerBox = await composer.boundingBox();
    const navigationBox = await mobileNavigation.boundingBox();

    expect(composerBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(
      navigationBox!.y
    );

    await attachScreenshot(
      page,
      testInfo,
      "message-conversation-mobile",
      false
    );
  });
});
