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

type ConsoleRecord = {
  kind: "console" | "pageerror";
  text: string;
};

type MissionTarget = {
  profile: "client" | "provider";
  href: string;
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
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function assertObjectiveLayout(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const main = document.querySelector<HTMLElement>("#klyx-main-content, main");
    const mainRect = main?.getBoundingClientRect() ?? null;

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [role="combobox"]'
      )
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

    const horizontallyClipped = candidates
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const intersectsVertically = rect.bottom > 0 && rect.top < viewportHeight;
        return intersectsVertically && (rect.left < -1 || rect.right > viewportWidth + 1);
      })
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 60) ?? ""} [${Math.round(rect.left)},${Math.round(rect.right)}]`;
      });

    const fixedOutsideViewport = Array.from(
      document.querySelectorAll<HTMLElement>("body *")
    )
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
        return `${element.tagName.toLowerCase()} [${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)}]`;
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
        if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) return false;
        const hit = document.elementFromPoint(x, y);
        return Boolean(hit && hit !== element && !element.contains(hit));
      })
      .slice(0, 12)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 60) ?? ""}`
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
          Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left)
        );
        const intersectionHeight = Math.max(
          0,
          Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top)
        );
        const intersectionArea = intersectionWidth * intersectionHeight;
        const rightArea = rightRect.width * rightRect.height;
        const smallerArea = Math.min(leftArea, rightArea);

        if (intersectionArea > 64 && smallerArea > 0 && intersectionArea / smallerArea > 0.25) {
          overlaps.push(
            `${left.tagName.toLowerCase()}↔${right.tagName.toLowerCase()} overlap=${Math.round(intersectionArea / smallerArea * 100)}%`
          );
          if (overlaps.length >= 12) break;
        }
      }
      if (overlaps.length >= 12) break;
    }

    return {
      horizontalOverflow: root.scrollWidth - root.clientWidth,
      bodyHorizontalOverflow: document.body.scrollWidth - root.clientWidth,
      mainVisible:
        Boolean(main && mainRect) &&
        mainRect!.width > 20 &&
        mainRect!.height > 20 &&
        main!.getAttribute("aria-hidden") !== "true" &&
        !main!.hasAttribute("inert"),
      bodyTextLength: document.body.innerText.trim().length,
      horizontallyClipped,
      fixedOutsideViewport,
      blockedControls,
      overlaps,
    };
  });

  expect.soft(metrics.horizontalOverflow, `${label}: html horizontal overflow`).toBeLessThanOrEqual(1);
  expect.soft(metrics.bodyHorizontalOverflow, `${label}: body horizontal overflow`).toBeLessThanOrEqual(1);
  expect.soft(metrics.mainVisible, `${label}: main content must remain accessible`).toBe(true);
  expect.soft(metrics.bodyTextLength, `${label}: page content unexpectedly empty`).toBeGreaterThan(40);
  expect.soft(metrics.horizontallyClipped, `${label}: interactive elements outside viewport`).toEqual([]);
  expect.soft(metrics.fixedOutsideViewport, `${label}: fixed/sticky element outside viewport`).toEqual([]);
  expect.soft(metrics.blockedControls, `${label}: visible enabled controls blocked by another layer`).toEqual([]);
  expect.soft(metrics.overlaps, `${label}: overlapping interactive components`).toEqual([]);
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
      expect.soft(box.x, `${label}: desktop rail shifted horizontally`).toBeLessThanOrEqual(2);
      expect.soft(box.y, `${label}: desktop rail shifted vertically`).toBeLessThanOrEqual(2);
      expect.soft(box.width, `${label}: desktop rail width`).toBeGreaterThanOrEqual(240);
      expect.soft(box.width, `${label}: desktop rail width`).toBeLessThanOrEqual(264);
    }

    const visibleRail = page.locator('[data-testid="desktop-mission-rail"]:visible');
    await expect.soft(visibleRail.locator('[data-testid="account-switcher"]')).toHaveCount(1);
    await expect.soft(visibleRail.locator("details")).toHaveCount(1);
    return;
  }

  await expect.soft(page.getByTestId("assistant-shell-mobile-header")).toBeVisible();
  await expect.soft(page.getByTestId("assistant-shell-mobile-menu")).toBeVisible();
  await expect.soft(rail).toBeHidden();

  await page.getByTestId("assistant-shell-mobile-menu").click();
  const drawer = page.getByRole("dialog", { name: "KLYX" });
  await expect.soft(drawer).toBeVisible();
  await expect.soft(drawer.getByTestId("mobile-mission-rail")).toBeVisible();
  await expect.soft(drawer.locator('[data-testid="account-switcher"]')).toHaveCount(1);
  await expect.soft(drawer.locator("details")).toHaveCount(1);
  await assertObjectiveLayout(page, `${label} mobile drawer`);
  await page.keyboard.press("Escape");
  await expect.soft(drawer).toHaveCount(0);
}

async function captureReference(page: Page, testInfo: TestInfo, name: string) {
  const sanitized = name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

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
  const comboboxes = page.getByRole("combobox");
  const count = await comboboxes.count();
  let found = false;

  for (let index = 0; index < count; index += 1) {
    const combobox = comboboxes.nth(index);
    if (!(await combobox.isVisible())) continue;

    await combobox.click();
    const labels = await page.getByRole("option").allTextContents();
    if (labels.some((label) => label.includes("Français"))) {
      found = true;
      for (const language of CERTIFIED_LANGUAGE_LABELS) {
        expect.soft(labels, `Settings selector is missing certified language ${language}`).toContain(language);
      }
      expect.soft(labels.filter((label) => CERTIFIED_LANGUAGE_LABELS.includes(label.trim() as (typeof CERTIFIED_LANGUAGE_LABELS)[number]))).toHaveLength(CERTIFIED_LANGUAGE_LABELS.length);
      await page.keyboard.press("Escape");
      break;
    }
    await page.keyboard.press("Escape");
  }

  expect.soft(found, "Settings must expose the certified language selector").toBe(true);
}

async function voiceSmoke(page: Page) {
  const textarea = page.locator("form textarea").first();
  const voiceButton = page.locator('form button[aria-pressed]').first();

  await expect.soft(textarea).toBeVisible();
  await expect.soft(voiceButton).toBeVisible();
  await expect.soft(voiceButton).toBeEnabled();
  await textarea.fill("KLYX");
  await voiceButton.click();

  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __klyxUxVoice?: { starts: () => number } }).__klyxUxVoice?.starts() ?? 0
    )
  ).toBe(1);

  await page.evaluate(() =>
    (window as typeof window & { __klyxUxVoice?: { fireStart: () => void } }).__klyxUxVoice?.fireStart()
  );
  await expect.soft(voiceButton).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() =>
    (window as typeof window & { __klyxUxVoice?: { emitResult: (value: string) => void } }).__klyxUxVoice?.emitResult(" test voix")
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

  await expect.poll(() =>
    page.evaluate(() =>
      (window as typeof window & { __klyxUxCameraStarts?: number }).__klyxUxCameraStarts ?? 0
    )
  ).toBe(1);
  await expect.soft(page.getByText(/Accès caméra refusé/)).toBeVisible();
}

async function findActiveMission(page: Page): Promise<MissionTarget | null> {
  await activateKlyxE2EProfile(page, "client");
  const clientHref = await page.evaluate(async () => {
    const response = await fetch("/api/bookings/overview", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      cards?: Array<{ id?: string; entityType?: string; href?: string; history?: boolean }>;
    };
    const mission = (body.cards ?? []).find((card) => card.history === false && card.id);
    if (!mission) return null;
    if (mission.href?.startsWith("/")) return mission.href;
    return mission.entityType === "group"
      ? `/booking-groups/${mission.id}`
      : `/bookings/${mission.id}`;
  });
  if (clientHref) return { profile: "client", href: clientHref };

  await activateKlyxE2EProfile(page, "provider");
  const providerHref = await page.evaluate(async () => {
    const response = await fetch("/api/provider/jobs", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      confirmedMissions?: Array<{
        id?: string;
        entityType?: string;
        href?: string;
        history?: boolean;
      }>;
    };
    const mission = (body.confirmedMissions ?? []).find(
      (card) => card.history === false && card.id
    );
    if (!mission) return null;
    if (mission.href?.startsWith("/")) return mission.href;
    return mission.entityType === "group"
      ? `/booking-groups/${mission.id}`
      : `/bookings/${mission.id}`;
  });

  return providerHref ? { profile: "provider", href: providerHref } : null;
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
  expect.soft(response?.status() ?? 599, `${label}: document HTTP status`).toBeLessThan(400);
  expect.soft(new URL(page.url()).pathname, `${label}: must not bounce to login`).not.toBe("/login");
  await settlePage(page);

  await assertShell(page, testInfo.project.name, label);
  await assertObjectiveLayout(page, label);

  const newConsoleFailures = consoleRecords.slice(consoleStart);
  expect.soft(newConsoleFailures, `${label}: browser console/page errors`).toEqual([]);
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
    await activateKlyxE2EProfile(page, "client");

    await visitCriticalSurface(page, testInfo, "/assistant", "assistant", consoleRecords);
    await voiceSmoke(page);

    await visitCriticalSurface(page, testInfo, "/profile", "profile", consoleRecords);
    await visitCriticalSurface(page, testInfo, "/settings", "settings", consoleRecords);
    await assertCertifiedLanguages(page);

    await visitCriticalSurface(page, testInfo, "/request/photo", "request-photo", consoleRecords);
    await photoLiveSmoke(page);

    const mission = await findActiveMission(page);
    expect(mission, "Dedicated E2E account must expose at least one active mission").not.toBeNull();
    if (!mission) return;

    await activateKlyxE2EProfile(page, mission.profile);
    await visitCriticalSurface(
      page,
      testInfo,
      mission.href,
      `active-mission-${mission.profile}`,
      consoleRecords
    );
  });
});
