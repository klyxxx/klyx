import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { KLYX_LANGUAGE_OPTIONS } from "../../lib/klyx-i18n";
import { translateKlyxSettingsPage } from "../../lib/klyx-settings-page-i18n";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";
import {
  attachUxDiagnostics,
  certifyMissionRail,
  collectUxDiagnostics,
  expectHealthyUxDiagnostics,
  expectReferenceScreenshot,
  settleVisualPage,
} from "./helpers/ux-certification";

const CRITICAL_ROUTES = [
  "/assistant",
  "/profile",
  "/settings",
  "/request/photo",
] as const;

function routeName(route: string) {
  return route.replace(/^\//, "").replace(/\//g, "-") || "home";
}

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

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return errors;
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

async function certifyRoute(
  page: Page,
  testInfo: TestInfo,
  route: string,
  runtimeErrors: string[],
  screenshotName: string,
  ready?: () => Promise<void>
) {
  runtimeErrors.length = 0;
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });

  expect(response, `${route}: missing document response`).toBeTruthy();
  expect(response!.status(), `${route}: HTTP failure`).toBeLessThan(400);
  expect(new URL(page.url()).pathname, `${route}: redirected to login`).not.toBe(
    "/login"
  );

  await settleVisualPage(page);
  if (ready) await ready();
  await expectReferenceScreenshot(page, screenshotName);
  await certifyMissionRail(page, isMobileProject(testInfo));

  const diagnostics = await collectUxDiagnostics(page, route);
  await attachUxDiagnostics(
    testInfo,
    screenshotName,
    diagnostics,
    [...runtimeErrors]
  );
  expectHealthyUxDiagnostics(diagnostics, runtimeErrors);
}

async function certifyLanguageSelector(page: Page) {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await settleVisualPage(page);

  const languageLabel = translateKlyxSettingsPage("fr", "language");
  const selectedLanguage = KLYX_LANGUAGE_OPTIONS.find(
    (option) => option.value === "fr"
  );
  expect(selectedLanguage, "French must remain a certified KLYX language").toBeTruthy();

  const disclosure = page.getByRole("button", {
    name: `${languageLabel} — ${selectedLanguage!.label}`,
    exact: true,
  });
  await expect(disclosure).toBeVisible();
  await expect(disclosure).toBeEnabled();
  await disclosure.click();

  const languageGroup = page.getByRole("radiogroup", {
    name: languageLabel,
    exact: true,
  });
  await expect(languageGroup).toBeVisible();

  const languageChoices = languageGroup.getByRole("radio");
  await expect(languageChoices).toHaveCount(KLYX_LANGUAGE_OPTIONS.length);
  for (const { label } of KLYX_LANGUAGE_OPTIONS) {
    await expect(
      languageGroup.getByRole("radio", { name: label, exact: true }),
      `Certified language missing from selector: ${label}`
    ).toBeVisible();
  }

  await expect(
    languageGroup.getByRole("radio", {
      name: selectedLanguage!.label,
      exact: true,
    })
  ).toHaveAttribute("aria-checked", "true");

  await disclosure.click();
  await expect(languageGroup).toBeHidden();
}

async function installVoiceSmokeMock(page: Page) {
  await page.evaluate(() => {
    type VoidHandler = (() => void) | null;

    const state = {
      starts: 0,
      stops: 0,
      current: null as MockSpeechRecognition | null,
    };

    class MockSpeechRecognition {
      lang = "";
      interimResults = true;
      continuous = true;
      onstart: VoidHandler = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: VoidHandler = null;

      start() {
        state.starts += 1;
        state.current = this;
        this.onstart?.();
      }

      stop() {
        state.stops += 1;
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: typeof MockSpeechRecognition;
      webkitSpeechRecognition?: typeof MockSpeechRecognition;
      __klyxUxVoice?: { snapshot: () => { starts: number; stops: number } };
    };

    Object.defineProperty(speechWindow, "SpeechRecognition", {
      configurable: true,
      writable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(speechWindow, "webkitSpeechRecognition", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    speechWindow.__klyxUxVoice = {
      snapshot: () => ({ starts: state.starts, stops: state.stops }),
    };
  });
}

async function certifyVoiceSmoke(page: Page) {
  await page.goto("/assistant", { waitUntil: "domcontentloaded" });
  await settleVisualPage(page);
  await installVoiceSmokeMock(page);

  const voiceButton = page.locator('form button[aria-pressed]').first();
  await expect(voiceButton).toBeVisible();
  await expect(voiceButton).toBeEnabled();
  await voiceButton.click();
  await expect(voiceButton).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __klyxUxVoice?: { snapshot: () => { starts: number } };
          }
        ).__klyxUxVoice?.snapshot().starts
      )
    )
    .toBe(1);

  await voiceButton.click();
  await expect(voiceButton).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __klyxUxVoice?: { snapshot: () => { stops: number } };
          }
        ).__klyxUxVoice?.snapshot().stops
      )
    )
    .toBe(1);
}

async function installLiveCameraSmokeMock(page: Page) {
  await page.evaluate(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) throw new Error("navigator.mediaDevices unavailable");

    let calls = 0;
    let stops = 0;
    let constraints: MediaStreamConstraints | null = null;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Synthetic camera canvas unavailable");
    context.fillRect(0, 0, canvas.width, canvas.height);

    const sourceStream = canvas.captureStream(5);
    const sourceTrack = sourceStream.getVideoTracks()[0];
    if (!sourceTrack) throw new Error("Synthetic camera track unavailable");
    const originalStop = sourceTrack.stop.bind(sourceTrack);
    sourceTrack.stop = () => {
      stops += 1;
      originalStop();
    };
    const stream = new MediaStream([sourceTrack]);

    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (requested: MediaStreamConstraints) => {
        calls += 1;
        constraints = requested;
        return stream;
      },
    });

    (
      window as typeof window & {
        __klyxUxCamera?: {
          snapshot: () => {
            calls: number;
            stops: number;
            constraints: MediaStreamConstraints | null;
          };
        };
      }
    ).__klyxUxCamera = {
      snapshot: () => ({ calls, stops, constraints }),
    };
  });
}

async function certifyPhotoLiveSmoke(page: Page) {
  await page.goto("/request/photo", { waitUntil: "domcontentloaded" });
  await settleVisualPage(page);
  await installLiveCameraSmokeMock(page);

  const startCamera = page.getByRole("button", {
    name: "Prendre une photo",
    exact: true,
  });
  await expect(startCamera).toBeVisible();
  await expect(startCamera).toBeEnabled();
  await startCamera.click();

  const video = page.getByLabel("Aperçu caméra KLYX");
  await expect(video).toBeVisible();

  const opened = await page.evaluate(() =>
    (
      window as typeof window & {
        __klyxUxCamera?: {
          snapshot: () => {
            calls: number;
            stops: number;
            constraints: MediaStreamConstraints | null;
          };
        };
      }
    ).__klyxUxCamera?.snapshot()
  );
  expect(opened?.calls).toBe(1);
  expect(opened?.constraints).toMatchObject({
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  });

  await page.getByRole("button", { name: "Fermer la caméra" }).click();
  await expect(video).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __klyxUxCamera?: { snapshot: () => { stops: number } };
          }
        ).__klyxUxCamera?.snapshot().stops
      )
    )
    .toBe(1);
}

test.describe("KLYX UX / Visual Certification", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("critical surfaces and one active mission stay measurable and visually stable", async ({
    page,
  }, testInfo) => {
    test.setTimeout(360_000);
    const runtimeErrors = captureRuntimeErrors(page);

    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await forceDeterministicLocaleAndRail(page);
    await mockDeterministicActiveMission(page);

    for (const route of CRITICAL_ROUTES) {
      await test.step(`${route} measurable UX`, async () => {
        await certifyRoute(
          page,
          testInfo,
          route,
          runtimeErrors,
          `${routeName(route)}-${isMobileProject(testInfo) ? "mobile" : "desktop"}`
        );
      });
    }

    await test.step("certified languages remain selectable", async () => {
      runtimeErrors.length = 0;
      await certifyLanguageSelector(page);
      expect.soft(runtimeErrors, "Settings language selector emitted runtime errors").toEqual([]);
    });

    await test.step("deterministic active mission view", async () => {
      const missionLink = page
        .getByRole("main")
        .locator('a[href="/bookings/e2e-action"]');
      await certifyRoute(
        page,
        testInfo,
        "/bookings",
        runtimeErrors,
        `active-mission-${isMobileProject(testInfo) ? "mobile" : "desktop"}`,
        async () => {
          await expect(missionLink).toBeVisible();
          await expect(missionLink).toBeEnabled();
        }
      );
    });
  });

  test("Voice and Photo live controls remain real browser entry points", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const runtimeErrors = captureRuntimeErrors(page);

    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await forceDeterministicLocaleAndRail(page);
    await mockDeterministicActiveMission(page);

    runtimeErrors.length = 0;
    await certifyVoiceSmoke(page);
    expect.soft(runtimeErrors, "Voice smoke emitted runtime errors").toEqual([]);

    runtimeErrors.length = 0;
    await certifyPhotoLiveSmoke(page);
    expect.soft(runtimeErrors, "Photo live smoke emitted runtime errors").toEqual([]);
  });
});