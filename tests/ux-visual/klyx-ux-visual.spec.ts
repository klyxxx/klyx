import { expect, test, type Page, type TestInfo } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "../e2e/helpers/authenticated-session";

const HAS_REFERENCE_SCREENSHOTS =
  process.env.KLYX_VISUAL_BASELINE_AVAILABLE === "1" ||
  process.env.KLYX_VISUAL_UPDATE_BASELINE === "1";

const CERTIFIED_LANGUAGE_LABELS = [
  "Français",
  "English",
  "Nederlands",
  "Deutsch",
] as const;

const FIXTURE_BOOKING_ID = "00000000-0000-4000-8000-000000000712";
const FIXTURE_PROVIDER_ID = "00000000-0000-4000-8000-000000000713";
const FIXTURE_SERVICE_ID = "00000000-0000-4000-8000-000000000714";
const FIXTURE_MISSION_HREF = `/bookings/${FIXTURE_BOOKING_ID}`;
const INTERACTIVE_SELECTOR =
  'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [role="combobox"]';

type ConsoleRecord = {
  kind: "console" | "pageerror";
  text: string;
};

function installBrowserCapabilityMocks(page: Page) {
  return page.addInitScript(() => {
    type VoidHandler = (() => void) | null;
    type ResultHandler = ((event: unknown) => void) | null;
    type ErrorHandler = ((event: unknown) => void) | null;

    const voiceState = {
      starts: 0,
      current: null as MockSpeechRecognition | null,
    };

    class MockSpeechRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onstart: VoidHandler = null;
      onresult: ResultHandler = null;
      onerror: ErrorHandler = null;
      onend: VoidHandler = null;

      start() {
        voiceState.starts += 1;
        voiceState.current = this;
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    const voiceWindow = window as typeof window & {
      SpeechRecognition?: typeof MockSpeechRecognition;
      webkitSpeechRecognition?: typeof MockSpeechRecognition;
      __klyxUxVoice?: {
        starts: () => number;
        fireStart: () => void;
        emitResult: (transcript: string) => void;
      };
      __klyxUxCameraStarts?: number;
    };

    Object.defineProperty(voiceWindow, "SpeechRecognition", {
      configurable: true,
      writable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(voiceWindow, "webkitSpeechRecognition", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    voiceWindow.__klyxUxVoice = {
      starts: () => voiceState.starts,
      fireStart: () => voiceState.current?.onstart?.(),
      emitResult: (transcript: string) => {
        voiceState.current?.onresult?.({ results: [[{ transcript }]] });
      },
    };

    voiceWindow.__klyxUxCameraStarts = 0;
    const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: mediaDevices,
    });
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        voiceWindow.__klyxUxCameraStarts =
          (voiceWindow.__klyxUxCameraStarts ?? 0) + 1;
        throw new DOMException("UX certification denied camera", "NotAllowedError");
      },
    });
  });
}

function collectConsoleFailures(page: Page) {
  const records: ConsoleRecord[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      records.push({ kind: "console", text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    records.push({ kind: "pageerror", text: error.message });
  });

  return records;
}

async function settlePage(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function assertObjectiveLayout(
  page: Page,
  label: string,
  scopeSelector?: string
) {
  const metrics = await page.evaluate(
    ({ interactiveSelector, scopeSelector }) => {
      const root = document.documentElement;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scope = scopeSelector
        ? document.querySelector<HTMLElement>(scopeSelector)
        : document.body;
      const main = document.querySelector<HTMLElement>("#klyx-main-content, main");
      const mainRect = main?.getBoundingClientRect() ?? null;
      const scopeRect = scope?.getBoundingClientRect() ?? null;

      const queryRoot: ParentNode = scope ?? document.body;
      const candidates = Array.from(
        queryRoot.querySelectorAll<HTMLElement>(interactiveSelector)
      ).filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 4 &&
          rect.height > 4
        );
      });

      function isInsideIntentionalHorizontalScroller(element: HTMLElement) {
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== scope?.parentElement) {
          const style = getComputedStyle(ancestor);
          const scrollable =
            (style.overflowX === "auto" || style.overflowX === "scroll") &&
            ancestor.scrollWidth > ancestor.clientWidth + 1;
          if (scrollable) return true;
          ancestor = ancestor.parentElement;
        }
        return false;
      }

      const horizontallyClipped = candidates
        .filter((element) => {
          if (isInsideIntentionalHorizontalScroller(element)) return false;
          const rect = element.getBoundingClientRect();
          const intersectsVertically = rect.bottom > 0 && rect.top < viewportHeight;
          return (
            intersectsVertically &&
            (rect.left < -1 || rect.right > viewportWidth + 1)
          );
        })
        .slice(0, 12)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${element.tagName.toLowerCase()} ${
            element.getAttribute("aria-label") ??
            element.textContent?.trim().slice(0, 60) ??
            ""
          } [${Math.round(rect.left)},${Math.round(rect.right)}]`;
        });

      const fixedCandidates = scope
        ? Array.from(scope.querySelectorAll<HTMLElement>("*"))
        : Array.from(document.querySelectorAll<HTMLElement>("body *"));
      const fixedOutsideViewport = fixedCandidates
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.position !== "fixed" && style.position !== "sticky") return false;
          if (style.display === "none" || style.visibility === "hidden") return false;
          const rect = element.getBoundingClientRect();
          if (rect.width <= 4 || rect.height <= 4) return false;
          if (rect.bottom <= 0 || rect.top >= viewportHeight) return false;
          return (
            rect.left < -1 ||
            rect.right > viewportWidth + 1 ||
            rect.top < -1 ||
            rect.bottom > viewportHeight + 1
          );
        })
        .slice(0, 12)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${element.tagName.toLowerCase()} [${Math.round(
            rect.left
          )},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(
            rect.bottom
          )}]`;
        });

      const enabled = candidates.filter((element) => {
        if (element instanceof HTMLButtonElement && element.disabled) return false;
        if (element instanceof HTMLInputElement && element.disabled) return false;
        if (element instanceof HTMLTextAreaElement && element.disabled) return false;
        if (element instanceof HTMLSelectElement && element.disabled) return false;
        return element.getAttribute("aria-disabled") !== "true";
      });

      const blockedControls = enabled
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.pointerEvents === "none") return true;
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) {
            return false;
          }
          const hit = document.elementFromPoint(x, y);
          return Boolean(hit && hit !== element && !element.contains(hit));
        })
        .slice(0, 12)
        .map(
          (element) =>
            `${element.tagName.toLowerCase()} ${
              element.getAttribute("aria-label") ??
              element.textContent?.trim().slice(0, 60) ??
              ""
            }`
        );

      const visibleEnabled = enabled.filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.bottom > 0 &&
          rect.top < viewportHeight &&
          rect.right > 0 &&
          rect.left < viewportWidth
        );
      });

      const overlaps: string[] = [];
      for (let leftIndex = 0; leftIndex < visibleEnabled.length; leftIndex += 1) {
        const left = visibleEnabled[leftIndex];
        const leftRect = left.getBoundingClientRect();
        const leftArea = leftRect.width * leftRect.height;

        for (
          let rightIndex = leftIndex + 1;
          rightIndex < visibleEnabled.length;
          rightIndex += 1
        ) {
          const right = visibleEnabled[rightIndex];
          if (left.contains(right) || right.contains(left)) continue;

          const rightRect = right.getBoundingClientRect();
          const intersectionWidth = Math.max(
            0,
            Math.min(leftRect.right, rightRect.right) -
              Math.max(leftRect.left, rightRect.left)
          );
          const intersectionHeight = Math.max(
            0,
            Math.min(leftRect.bottom, rightRect.bottom) -
              Math.max(leftRect.top, rightRect.top)
          );
          const intersectionArea = intersectionWidth * intersectionHeight;
          const rightArea = rightRect.width * rightRect.height;
          const smallerArea = Math.min(leftArea, rightArea);

          if (
            intersectionArea > 64 &&
            smallerArea > 0 &&
            intersectionArea / smallerArea > 0.25
          ) {
            overlaps.push(
              `${left.tagName.toLowerCase()}↔${right.tagName.toLowerCase()} overlap=${Math.round(
                (intersectionArea / smallerArea) * 100
              )}%`
            );
            if (overlaps.length >= 12) break;
          }
        }
        if (overlaps.length >= 12) break;
      }

      let horizontalOverflow = 0;
      if (!scopeSelector) {
        const originalX = window.scrollX;
        const originalY = window.scrollY;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(root.scrollWidth, originalY);
        horizontalOverflow = Math.max(0, window.scrollX - originalX);
        window.scrollTo(originalX, originalY);
        root.style.scrollBehavior = previousScrollBehavior;
      }

      const scopeVisible = Boolean(
        scope &&
          scopeRect &&
          scopeRect.width > 20 &&
          scopeRect.height > 20 &&
          getComputedStyle(scope).display !== "none" &&
          getComputedStyle(scope).visibility !== "hidden"
      );

      return {
        horizontalOverflow,
        rawRootOverflow: root.scrollWidth - root.clientWidth,
        mainVisible: scopeSelector
          ? scopeVisible
          : Boolean(main && mainRect) &&
            mainRect!.width > 20 &&
            mainRect!.height > 20 &&
            main!.getAttribute("aria-hidden") !== "true" &&
            !main!.hasAttribute("inert"),
        bodyTextLength: (scope?.innerText ?? "").trim().length,
        horizontallyClipped,
        fixedOutsideViewport,
        blockedControls,
        overlaps,
      };
    },
    { interactiveSelector: INTERACTIVE_SELECTOR, scopeSelector: scopeSelector ?? null }
  );

  expect
    .soft(
      metrics.horizontalOverflow,
      `${label}: user-reachable horizontal page scroll (raw root delta ${metrics.rawRootOverflow}px)`
    )
    .toBeLessThanOrEqual(1);
  expect
    .soft(metrics.mainVisible, `${label}: certified content must remain accessible`)
    .toBe(true);
  expect
    .soft(metrics.bodyTextLength, `${label}: certified content unexpectedly empty`)
    .toBeGreaterThan(20);
  expect
    .soft(
      metrics.horizontallyClipped,
      `${label}: interactive elements outside viewport`
    )
    .toEqual([]);
  expect
    .soft(
      metrics.fixedOutsideViewport,
      `${label}: fixed/sticky element outside viewport`
    )
    .toEqual([]);
  expect
    .soft(
      metrics.blockedControls,
      `${label}: visible enabled controls blocked by another layer`
    )
    .toEqual([]);
  expect
    .soft(metrics.overlaps, `${label}: overlapping interactive components`)
    .toEqual([]);
}

async function assertShell(page: Page, projectName: string, label: string) {
  const desktop = projectName === "desktop-chrome";
  const rail = page.getByTestId("desktop-mission-rail");

  if (desktop) {
    await expect.soft(rail, `${label}: desktop mission rail`).toBeVisible();
    await expect.soft(page.getByTestId("assistant-shell-mobile-header")).toBeHidden();

    const box = await rail.boundingBox();
    expect.soft(box, `${label}: desktop rail box`).not.toBeNull();
    if (box) {
      expect
        .soft(box.x, `${label}: desktop rail shifted horizontally`)
        .toBeLessThanOrEqual(2);
      expect
        .soft(box.y, `${label}: desktop rail shifted vertically`)
        .toBeLessThanOrEqual(2);
      expect
        .soft(box.width, `${label}: desktop rail width`)
        .toBeGreaterThanOrEqual(240);
      expect
        .soft(box.width, `${label}: desktop rail width`)
        .toBeLessThanOrEqual(264);
    }

    const visibleRail = page.locator(
      '[data-testid="desktop-mission-rail"]:visible'
    );
    await expect
      .soft(visibleRail.locator('[data-testid="account-switcher"]'))
      .toHaveCount(1);
    await expect.soft(visibleRail.locator("details")).toHaveCount(1);
    await expect
      .soft(visibleRail.getByText("Compte", { exact: true }))
      .toHaveCount(1);
    return;
  }

  await expect.soft(page.getByTestId("assistant-shell-mobile-header")).toBeVisible();
  await expect.soft(page.getByTestId("assistant-shell-mobile-menu")).toBeVisible();
  await expect.soft(rail).toBeHidden();

  await page.getByTestId("assistant-shell-mobile-menu").click();
  const drawerSelector = '[role="dialog"][aria-modal="true"]';
  const drawer = page.locator(drawerSelector);
  await expect.soft(drawer).toBeVisible();
  await expect.soft(drawer.getByTestId("mobile-mission-rail")).toBeVisible();
  await expect
    .soft(drawer.locator('[data-testid="account-switcher"]'))
    .toHaveCount(1);
  await expect.soft(drawer.locator("details")).toHaveCount(1);
  await expect.soft(drawer.getByText("Compte", { exact: true })).toHaveCount(1);
  await assertObjectiveLayout(page, `${label} mobile drawer`, drawerSelector);
  await page.keyboard.press("Escape");
  await expect.soft(drawer).toHaveCount(0);
}

async function captureReference(page: Page, testInfo: TestInfo, name: string) {
  const sanitized = name
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  if (HAS_REFERENCE_SCREENSHOTS) {
    await expect.soft(page).toHaveScreenshot(`${sanitized}.png`, {
      fullPage: true,
      mask: [page.locator("video, iframe")],
    });
    return;
  }

  await testInfo.attach(`bootstrap-${sanitized}`, {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
}

async function assertCertifiedLanguages(page: Page) {
  const disclosure = page
    .getByRole("button", { name: /^(Langue|Language|Taal|Sprache)$/ })
    .first();
  await expect.soft(disclosure).toBeVisible();

  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }

  const combobox = page
    .getByRole("combobox", { name: /^(Langue|Language|Taal|Sprache)$/ })
    .first();
  await expect.soft(combobox).toBeVisible();
  await combobox.click();

  const options = page.getByRole("option");
  await expect.soft(options.first()).toBeVisible();
  const labels = (await options.allTextContents()).map((label) => label.trim());

  for (const language of CERTIFIED_LANGUAGE_LABELS) {
    expect.soft(
      labels,
      `Settings selector is missing certified language ${language}`
    ).toContain(language);
  }

  const certified = labels.filter((label) =>
    CERTIFIED_LANGUAGE_LABELS.includes(
      label as (typeof CERTIFIED_LANGUAGE_LABELS)[number]
    )
  );
  expect.soft(new Set(certified).size).toBe(CERTIFIED_LANGUAGE_LABELS.length);
  await page.keyboard.press("Escape");
}

async function voiceSmoke(page: Page) {
  const textarea = page.locator("form textarea").first();
  const voiceButton = page.locator('form button[aria-pressed]').first();

  await expect.soft(textarea).toBeVisible();
  await expect.soft(voiceButton).toBeVisible();
  await expect.soft(voiceButton).toBeEnabled();
  await textarea.fill("KLYX");
  await voiceButton.click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __klyxUxVoice?: { starts: () => number };
            }
          ).__klyxUxVoice?.starts() ?? 0
      )
    )
    .toBe(1);

  await page.evaluate(() =>
    (
      window as typeof window & {
        __klyxUxVoice?: { fireStart: () => void };
      }
    ).__klyxUxVoice?.fireStart()
  );
  await expect.soft(voiceButton).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() =>
    (
      window as typeof window & {
        __klyxUxVoice?: { emitResult: (value: string) => void };
      }
    ).__klyxUxVoice?.emitResult(" test voix")
  );
  await expect.soft(textarea).toHaveValue(/KLYX.*test voix/);

  await voiceButton.click();
  await expect.soft(voiceButton).toHaveAttribute("aria-pressed", "false");
}

async function photoLiveSmoke(page: Page) {
  const cameraButton = page.getByRole("button", { name: "Prendre une photo" });
  await expect.soft(cameraButton).toBeVisible();
  await expect.soft(cameraButton).toBeEnabled();
  await cameraButton.click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __klyxUxCameraStarts?: number }
          ).__klyxUxCameraStarts ?? 0
      )
    )
    .toBe(1);
  await expect.soft(page.getByText(/Accès caméra refusé/)).toBeVisible();
}

async function fulfillGetOnly(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  body: unknown
) {
  if (route.request().method() !== "GET") {
    await route.fallback();
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installActiveMissionFixture(page: Page, clientProfileId: string) {
  await page.route("**/api/bookings/overview", async (route) => {
    await fulfillGetOnly(route, {
      accountType: "client",
      cards: [
        {
          id: FIXTURE_BOOKING_ID,
          entityType: "booking",
          href: FIXTURE_MISSION_HREF,
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
          dateFrom: "2026-09-10",
          dateTo: "2026-09-10",
          firstStart: "09:00",
          lastEnd: "11:00",
          slotCount: 1,
          actionRequired: true,
          history: false,
          cancellationPending: false,
          refundStatus: "",
          createdAt: "2026-09-10T08:00:00.000Z",
        },
      ],
      childBookingsHidden: 0,
      groupedDisplay: true,
    });
  });

  await page.route("**/api/bookings/activity-hidden", async (route) => {
    await fulfillGetOnly(route, { ok: true, hidden: [] });
  });

  await page.route("**/api/bookings/split-missions", async (route) => {
    await fulfillGetOnly(route, { missions: [], childBookingIds: [] });
  });

  await page.route("**/rest/v1/bookings**", async (route) => {
    await fulfillGetOnly(route, {
      id: FIXTURE_BOOKING_ID,
      parent_id: clientProfileId,
      provider_id: FIXTURE_PROVIDER_ID,
      babysitter_id: null,
      service_id: FIXTURE_SERVICE_ID,
      booking_date: "2026-09-10",
      start_time: "09:00:00",
      end_time: "11:00:00",
      message: "Mission UX déterministe",
      status: "pending",
      payment_status: "pending",
      refund_status: null,
      service_status: null,
      pricing_type_snapshot: "hourly",
      unit_price_cents: 3250,
      estimated_amount_cents: 6500,
      amount_total: null,
      currency: "EUR",
      payment_failure_message: null,
      provider_response: null,
      cancellation_reason: null,
      cancelled_by: null,
      created_at: "2026-09-10T08:00:00.000Z",
      accepted_at: null,
      rejected_at: null,
      cancelled_at: null,
      completed_at: null,
    });
  });

  await page.route("**/rest/v1/booking_status_events**", async (route) => {
    await fulfillGetOnly(route, []);
  });

  await page.route("**/rest/v1/profiles**", async (route) => {
    await fulfillGetOnly(route, [
      {
        id: clientProfileId,
        first_name: "Client",
        last_name: "KLYX",
        avatar_url: null,
      },
      {
        id: FIXTURE_PROVIDER_ID,
        first_name: "Prestataire",
        last_name: "KLYX",
        avatar_url: null,
      },
    ]);
  });

  await page.route("**/rest/v1/services**", async (route) => {
    await fulfillGetOnly(route, { id: FIXTURE_SERVICE_ID, slug: "menage" });
  });
}

async function assertActiveMissionFixtureRendered(page: Page) {
  await page.goto("/assistant", { waitUntil: "domcontentloaded" });
  await settlePage(page);

  const rail = page.getByTestId("desktop-mission-rail");
  if (await rail.isVisible()) {
    await expect(
      rail.locator(`section[aria-label="En cours"] a[href="${FIXTURE_MISSION_HREF}"]`)
    ).toBeVisible();
    return;
  }

  await page.getByTestId("assistant-shell-mobile-menu").click();
  const drawer = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(
    drawer.locator(`section[aria-label="En cours"] a[href="${FIXTURE_MISSION_HREF}"]`)
  ).toBeVisible();
  await page.keyboard.press("Escape");
}

async function visitCriticalSurface(
  page: Page,
  testInfo: TestInfo,
  route: string,
  label: string,
  consoleRecords: ConsoleRecord[]
) {
  const consoleStart = consoleRecords.length;
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect.soft(response, `${label}: document response`).toBeTruthy();
  expect
    .soft(response?.status() ?? 599, `${label}: document HTTP status`)
    .toBeLessThan(400);
  expect
    .soft(new URL(page.url()).pathname, `${label}: must not bounce to login`)
    .not.toBe("/login");
  await settlePage(page);

  await assertShell(page, testInfo.project.name, label);
  await assertObjectiveLayout(page, label);

  const newConsoleFailures = consoleRecords.slice(consoleStart);
  expect
    .soft(newConsoleFailures, `${label}: browser console/page errors`)
    .toEqual([]);
  await captureReference(page, testInfo, label);
}

test.describe("KLYX UX / Visual Certification", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are required for UX / Visual Certification."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("critical authenticated UX remains measurable and visually stable", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    await installBrowserCapabilityMocks(page);
    const consoleRecords = collectConsoleFailures(page);

    await loginKlyxE2E(page);
    const clientProfile = await activateKlyxE2EProfile(page, "client");

    await visitCriticalSurface(
      page,
      testInfo,
      "/assistant",
      "assistant",
      consoleRecords
    );
    await voiceSmoke(page);

    await visitCriticalSurface(
      page,
      testInfo,
      "/profile",
      "profile",
      consoleRecords
    );
    await visitCriticalSurface(
      page,
      testInfo,
      "/settings",
      "settings",
      consoleRecords
    );
    await assertCertifiedLanguages(page);

    await visitCriticalSurface(
      page,
      testInfo,
      "/request/photo",
      "request-photo",
      consoleRecords
    );
    await photoLiveSmoke(page);

    await installActiveMissionFixture(page, clientProfile.id);
    await assertActiveMissionFixtureRendered(page);
    await visitCriticalSurface(
      page,
      testInfo,
      FIXTURE_MISSION_HREF,
      "active-mission-client",
      consoleRecords
    );
  });
});
