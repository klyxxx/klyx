import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

const REQUEST_QUERY =
  "service=cleaning&city=Bruxelles&date=2026-09-20&time=10%3A00&duration=2&budget=80";
const REQUEST_CONFIRM_ROUTE = `/request/confirm?${REQUEST_QUERY}`;
const RECOMMENDATIONS_ROUTE = `/recommendations?${REQUEST_QUERY}`;

const SURFACES = [
  { route: "/assistant", snapshot: "assistant" },
  { route: "/profile", snapshot: "profile" },
  { route: "/settings", snapshot: "settings" },
  { route: "/request/photo", snapshot: "request-photo" },
  { route: REQUEST_CONFIRM_ROUTE, snapshot: "request-confirm" },
  { route: RECOMMENDATIONS_ROUTE, snapshot: "recommendations" },
  { route: "/bookings", snapshot: "active-mission" },
] as const;

type UxDiagnostics = {
  route: string;
  horizontalOverflow: boolean;
  overflowingElements: string[];
  outOfViewport: string[];
  fixedOrStickyOutOfViewport: string[];
  blockedInteractives: string[];
  overlappingInteractives: string[];
  contrastFailures: string[];
  mainVisible: boolean;
  longContentScrollable: boolean;
};

function isMobile(testInfo: TestInfo) {
  return testInfo.project.name === "mobile-chromium";
}

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function installDeterministicDarkEnvironment(page: Page) {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("klyx_language", "fr");
      localStorage.setItem("klyx_theme", "dark");
      localStorage.setItem("klyx:mission-rail:collapsed", "false");
    } catch {
      // about:blank may not expose storage yet; the authenticated page will.
    }
  });
}

async function enforceDeterministicDarkEnvironment(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("klyx_language", "fr");
    localStorage.setItem("klyx_theme", "dark");
    localStorage.setItem("klyx:mission-rail:collapsed", "false");
    document.cookie = "klyx_locale=fr; Path=/; SameSite=Lax";
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  });
}

async function settle(page: Page) {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    window.scrollTo(0, 0);
  });
}

async function mockDeterministicMission(page: Page) {
  await page.route("**/api/bookings/overview", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
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
            dateFrom: "2026-09-20",
            dateTo: "2026-09-20",
            firstStart: "10:00",
            lastEnd: "12:00",
            slotCount: 1,
            actionRequired: true,
            history: false,
            cancellationPending: false,
            refundStatus: "",
            createdAt: "2026-09-11T12:00:00.000Z",
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
            dateFrom: "2026-09-22",
            dateTo: "2026-09-22",
            firstStart: "14:00",
            lastEnd: "15:30",
            slotCount: 1,
            actionRequired: false,
            history: false,
            cancellationPending: false,
            refundStatus: "",
            createdAt: "2026-09-11T11:00:00.000Z",
          },
        ],
        childBookingsHidden: 0,
        groupedDisplay: true,
      }),
    });
  });

  await page.route("**/api/bookings/split-missions", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ missions: [], childBookingIds: [] }),
    });
  });

  await page.route("**/api/bookings/activity-hidden", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
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

async function mockDeterministicRecommendations(page: Page) {
  await page.route("**/api/search/providers?**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const providers = [
      ["1", "Nora", 24, 94, 128, 7],
      ["2", "Samir", 27, 91, 96, 5],
      ["3", "Lina", 29, 89, 74, 4],
    ].map(([id, firstName, price, score, jobs, experience]) => ({
      profileId: `e2e-provider-${id}`,
      userServiceId: `e2e-service-${id}`,
      serviceSlug: "cleaning",
      serviceLabel: "Ménage",
      firstName,
      lastName: "KLYX",
      businessName: "",
      avatarUrl: null,
      headline: "Disponible à Bruxelles pour cette demande.",
      title: "Ménage à domicile",
      pricingType: "hourly",
      price,
      city: "Bruxelles",
      serviceArea: ["Bruxelles"],
      travelRadiusKm: 10,
      klyxScore: score,
      completedJobs: jobs,
      cancellationRate: 0.01,
      rating: 4.9,
      reviewCount: 64,
      yearsExperience: experience,
      isVerified: true,
      qualificationLevel: "verified",
      qualificationApproved: true,
      qualificationLabel: "Vérifié",
      officialRegistrationLabel: null,
      availabilitySummary: "Disponible le 20 septembre à 10:00",
      isExactMatch: true,
    }));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providers,
        exactCount: providers.length,
        totalCandidates: providers.length,
        showingAlternatives: false,
      }),
    });
  });
}

async function expectDarkAssistantDirection(page: Page, route: string) {
  await expect.soft(page.locator("html"), `${route}: dark class missing`).toHaveClass(/dark/);
  const palette = await page.evaluate(() => {
    const background = getComputedStyle(document.body).backgroundColor;
    const rgb = background
      .match(/rgba?\(([^)]+)\)/i)?.[1]
      .split(/[\s,\/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(Number);
    const luminance =
      rgb && rgb.length === 3 && rgb.every(Number.isFinite)
        ? rgb.reduce((sum, value, index) => {
            const normalized = value / 255;
            const linear =
              normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            return sum + linear * (index === 0 ? 0.2126 : index === 1 ? 0.7152 : 0.0722);
          }, 0)
        : null;
    return {
      background,
      luminance,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    };
  });

  expect.soft(palette.colorScheme, `${route}: dark color-scheme missing`).toBe("dark");
  expect.soft(palette.luminance, `${route}: body color unreadable (${palette.background})`).not.toBeNull();
  expect
    .soft(
      palette.luminance ?? 1,
      `${route}: body is too bright for the black assistant-first direction (${palette.background})`
    )
    .toBeLessThanOrEqual(0.2);

  const legacySidebarCount = await page.getByTestId("desktop-sidebar").count();
  expect
    .soft(legacySidebarCount, `${route}: legacy SaaS sidebar is still mounted`)
    .toBe(0);
  return legacySidebarCount === 0;
}

async function collectDiagnostics(page: Page, route: string): Promise<UxDiagnostics> {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const viewportHeight = root.clientHeight;

    function label(element: HTMLElement) {
      return (
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent ||
        element.getAttribute("name") ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);
    }

    function describe(element: HTMLElement, withBox = false) {
      const rect = element.getBoundingClientRect();
      const text = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${label(element) ? ` "${label(element)}"` : ""}`;
      return withBox
        ? `${text} [x=${Math.round(rect.x)}, y=${Math.round(rect.y)}, w=${Math.round(rect.width)}, h=${Math.round(rect.height)}, right=${Math.round(rect.right)}, bottom=${Math.round(rect.bottom)}]`
        : text;
    }

    function inClosedDetails(element: HTMLElement) {
      const details = element.closest("details:not([open])");
      if (!details) return false;
      const summary = element.closest("summary");
      return !summary || summary.parentElement !== details;
    }

    function visible(element: HTMLElement) {
      if (element.hidden || element.closest('[hidden], [aria-hidden="true"]') || inClosedDetails(element)) {
        return false;
      }
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0.01 &&
        rect.width > 1 &&
        rect.height > 1
      );
    }

    function disabled(element: HTMLElement) {
      return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";
    }

    function skipLink(element: HTMLElement) {
      return (
        element instanceof HTMLAnchorElement &&
        element.getAttribute("href")?.startsWith("#") === true &&
        !element.matches(":focus, :focus-visible")
      );
    }

    type Rgba = { r: number; g: number; b: number; a: number };
    function parseColor(value: string): Rgba | null {
      const match = value.match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
      if (parts.length < 3) return null;
      const [r, g, b] = parts.slice(0, 3).map(Number);
      if (![r, g, b].every(Number.isFinite)) return null;
      const alpha = parts[3] == null ? 1 : Number(parts[3]);
      return { r, g, b, a: Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1 };
    }
    function composite(foreground: Rgba, background: Rgba): Rgba {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
        g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
        b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
        a: alpha,
      };
    }
    function backgroundFor(element: HTMLElement): Rgba {
      let result: Rgba = { r: 0, g: 0, b: 0, a: 0 };
      let cursor: HTMLElement | null = element;
      while (cursor) {
        const color = parseColor(getComputedStyle(cursor).backgroundColor);
        if (color && color.a > 0) {
          result = composite(result, color);
          if (result.a >= 0.999) return result;
        }
        cursor = cursor.parentElement;
      }
      return result.a >= 0.999 ? result : composite(result, { r: 0, g: 0, b: 0, a: 1 });
    }
    function luminance(color: Rgba) {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    }
    function contrast(foreground: Rgba, background: Rgba) {
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    }

    const interactiveSelector = [
      "a[href]",
      "button",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "summary",
      "[role='button']",
      "[role='link']",
      "[role='combobox']",
    ].join(",");
    const interactives = Array.from(
      document.querySelectorAll<HTMLElement>(interactiveSelector)
    ).filter(visible);

    const allVisible = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter(
      (element) => visible(element) && !skipLink(element)
    );
    const overflowingElements = allVisible
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -2 || rect.right > viewportWidth + 2;
      })
      .slice(0, 30)
      .map((element) => describe(element, true));

    const outOfViewport = interactives
      .filter((element) => {
        if (skipLink(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.left < -2 || rect.right > viewportWidth + 2;
      })
      .slice(0, 30)
      .map((element) => describe(element, true));

    const fixedOrStickyOutOfViewport = allVisible
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.position !== "fixed" && style.position !== "sticky") return false;
        const rect = element.getBoundingClientRect();
        return (
          rect.left < -2 ||
          rect.right > viewportWidth + 2 ||
          rect.top < -2 ||
          rect.bottom > viewportHeight + 2
        );
      })
      .slice(0, 30)
      .map((element) => describe(element, true));

    const inViewport = interactives.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth;
    });

    const blockedInteractives = inViewport
      .filter((element) => {
        if (disabled(element) || skipLink(element)) return false;
        if (getComputedStyle(element).pointerEvents === "none") return true;
        const rect = element.getBoundingClientRect();
        const x = Math.min(viewportWidth - 1, Math.max(0, rect.left + rect.width / 2));
        const y = Math.min(viewportHeight - 1, Math.max(0, rect.top + rect.height / 2));
        const hit = document.elementFromPoint(x, y);
        return !hit || !(hit === element || element.contains(hit));
      })
      .slice(0, 30)
      .map((element) => describe(element));

    const overlapCandidates = inViewport
      .filter((element) => !disabled(element) && !skipLink(element))
      .slice(0, 120);
    const overlappingInteractives: string[] = [];
    for (let leftIndex = 0; leftIndex < overlapCandidates.length; leftIndex += 1) {
      const left = overlapCandidates[leftIndex];
      const leftRect = left.getBoundingClientRect();
      for (let rightIndex = leftIndex + 1; rightIndex < overlapCandidates.length; rightIndex += 1) {
        const right = overlapCandidates[rightIndex];
        if (left.contains(right) || right.contains(left)) continue;
        const rightRect = right.getBoundingClientRect();
        const width = Math.max(0, Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left));
        const height = Math.max(0, Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top));
        if (width <= 4 || height <= 4) continue;
        const intersection = width * height;
        const smaller = Math.min(leftRect.width * leftRect.height, rightRect.width * rightRect.height);
        if (smaller > 0 && intersection / smaller >= 0.4) {
          overlappingInteractives.push(`${describe(left)} <> ${describe(right)}`);
          if (overlappingInteractives.length >= 30) break;
        }
      }
      if (overlappingInteractives.length >= 30) break;
    }

    const contrastFailures = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main h1, main h2, main h3, main p, main label, main a, main button, main summary, main input, main textarea, aside a, aside button, aside summary"
      )
    )
      .filter((element) => {
        if (!visible(element) || disabled(element)) return false;
        if (element.matches("input, textarea")) return true;
        return Boolean(element.textContent?.trim());
      })
      .map((element) => {
        const style = getComputedStyle(element);
        const foreground = parseColor(style.color);
        if (!foreground || foreground.a < 0.99) return null;
        const ratio = contrast(foreground, backgroundFor(element));
        const fontSize = Number.parseFloat(style.fontSize || "0");
        const fontWeight = Number.parseInt(style.fontWeight || "400", 10);
        const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const required = large ? 3 : 4.5;
        return ratio + 0.01 < required
          ? `${describe(element)} contrast=${ratio.toFixed(2)} required=${required.toFixed(1)}`
          : null;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 30);

    const main = document.querySelector<HTMLElement>("main");
    const mainRect = main?.getBoundingClientRect();
    const mainVisible = Boolean(
      main &&
        mainRect &&
        mainRect.width > 1 &&
        mainRect.height > 1 &&
        mainRect.right > 0 &&
        mainRect.left < viewportWidth &&
        mainRect.bottom > 0 &&
        mainRect.top < viewportHeight
    );

    return {
      horizontalOverflow: root.scrollWidth > root.clientWidth + 2,
      overflowingElements,
      outOfViewport,
      fixedOrStickyOutOfViewport,
      blockedInteractives,
      overlappingInteractives,
      contrastFailures,
      mainVisible,
    };
  });

  const longContentScrollable = await page.evaluate(async () => {
    const scrollingElement = document.scrollingElement;
    if (!scrollingElement) return true;
    const visibleHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    if (scrollingElement.scrollHeight <= visibleHeight + 2) return true;
    const before = scrollingElement.scrollTop;
    scrollingElement.scrollTop = scrollingElement.scrollHeight;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const reachedBottom =
      scrollingElement.scrollTop + visibleHeight >= scrollingElement.scrollHeight - 3;
    scrollingElement.scrollTop = before;
    return reachedBottom;
  });

  return { route, ...metrics, longContentScrollable };
}

function assertHealthy(diagnostics: UxDiagnostics, runtimeErrors: readonly string[]) {
  expect
    .soft(
      diagnostics.horizontalOverflow,
      `${diagnostics.route}: horizontal overflow (${diagnostics.overflowingElements.join(" | ") || "root"})`
    )
    .toBe(false);
  expect.soft(diagnostics.outOfViewport, `${diagnostics.route}: interactive outside viewport`).toEqual([]);
  expect
    .soft(diagnostics.fixedOrStickyOutOfViewport, `${diagnostics.route}: fixed/sticky outside viewport`)
    .toEqual([]);
  expect.soft(diagnostics.blockedInteractives, `${diagnostics.route}: blocked interactive`).toEqual([]);
  expect
    .soft(diagnostics.overlappingInteractives, `${diagnostics.route}: overlapping interactives`)
    .toEqual([]);
  expect.soft(diagnostics.contrastFailures, `${diagnostics.route}: WCAG text contrast failure`).toEqual([]);
  expect.soft(diagnostics.mainVisible, `${diagnostics.route}: main is not visible`).toBe(true);
  expect.soft(diagnostics.longContentScrollable, `${diagnostics.route}: page cannot scroll to the end`).toBe(true);
  expect.soft(runtimeErrors, `${diagnostics.route}: console/page errors`).toEqual([]);
}

async function screenshot(page: Page, name: string) {
  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    fullPage: false,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    maskColor: "#111113",
    mask: [
      page.locator('[data-testid="account-switcher"]'),
      page.locator('[data-testid="desktop-mission-rail"] section'),
      page.locator('[data-testid="mobile-mission-rail"] section'),
      page.locator("main time"),
      page.locator("main img"),
    ],
  });
}

async function visibleFocusables(scope: Locator) {
  const candidates = scope.locator(
    'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
  );
  const result: Locator[] = [];
  for (let index = 0; index < (await candidates.count()); index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible()) result.push(candidate);
  }
  return result;
}

async function certifyRail(page: Page, mobile: boolean) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  if (mobile) {
    await expect(page.getByTestId("desktop-mission-rail")).toBeHidden();
    const header = page.getByTestId("assistant-shell-mobile-header");
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect.soft(headerBox!.x).toBeGreaterThanOrEqual(-1);
    expect.soft(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(viewport!.width + 1);

    const trigger = page.getByTestId("assistant-shell-mobile-menu");
    await expect(trigger).toBeVisible();
    const overflowBefore = await page.evaluate(() => document.body.style.overflow);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "KLYX" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect.soft(box!.x).toBeGreaterThanOrEqual(-1);
    expect.soft(box!.y).toBeGreaterThanOrEqual(-1);
    expect.soft(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect.soft(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);

    const rail = dialog.getByTestId("mobile-mission-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByTestId("account-entry")).toHaveCount(1);

    const focusables = await visibleFocusables(dialog);
    expect(focusables.length, "drawer must expose keyboard controls").toBeGreaterThanOrEqual(2);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();

    const scrollRegion = rail.locator(".overflow-y-auto").first();
    await expect(scrollRegion).toBeVisible();
    const scrollResult = await scrollRegion.evaluate(async (element: HTMLElement) => {
      const before = element.scrollTop;
      const scrollable = element.scrollHeight > element.clientHeight + 2;
      if (scrollable) {
        element.scrollTop = element.scrollHeight;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const reached =
        !scrollable || element.scrollTop + element.clientHeight >= element.scrollHeight - 3;
      element.scrollTop = before;
      return { reached, overflowY: getComputedStyle(element).overflowY };
    });
    expect(["auto", "scroll"]).toContain(scrollResult.overflowY);
    expect.soft(scrollResult.reached, "mobile MissionRail cannot scroll to its end").toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(overflowBefore);
    return;
  }

  const rail = page.getByTestId("desktop-mission-rail");
  await expect(rail).toBeVisible();
  await expect(rail.getByTestId("account-entry")).toHaveCount(1);
  const box = await rail.boundingBox();
  expect(box).not.toBeNull();
  expect.soft(box!.x).toBeCloseTo(0, 0);
  expect.soft(box!.y).toBeCloseTo(0, 0);
  expect.soft(box!.width).toBeGreaterThanOrEqual(240);
  expect.soft(box!.width).toBeLessThanOrEqual(264);
  expect.soft(box!.height).toBeGreaterThanOrEqual(viewport!.height - 2);
  expect.soft(box!.height).toBeLessThanOrEqual(viewport!.height + 2);

  const content = page.locator(".klyx-app-content");
  const contentBox = await content.boundingBox();
  expect(contentBox).not.toBeNull();
  expect.soft(contentBox!.x).toBeGreaterThanOrEqual(box!.x + box!.width - 1);
}

async function certifyAccountMenu(page: Page, mobile: boolean) {
  if (mobile) {
    const trigger = page.getByTestId("assistant-shell-mobile-menu");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "KLYX" });
    await expect(dialog).toBeVisible();
    const account = dialog.getByTestId("account-entry");
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("link", { name: "Profil", exact: true })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Paramètres", exact: true })).toBeVisible();
    await screenshot(page, "account-menu-mobile");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    return;
  }

  const rail = page.getByTestId("desktop-mission-rail");
  const account = rail.getByTestId("account-entry");
  await account.focus();
  await page.keyboard.press("Enter");
  await expect(rail.getByRole("link", { name: "Profil", exact: true })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Paramètres", exact: true })).toBeVisible();
  await screenshot(page, "account-menu-desktop");
}

async function certifySurface(
  page: Page,
  testInfo: TestInfo,
  route: string,
  snapshot: string,
  runtimeErrors: string[]
) {
  runtimeErrors.length = 0;
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response, `${route}: no document response`).toBeTruthy();
  expect(response!.status(), `${route}: HTTP failure`).toBeLessThan(400);
  expect(new URL(page.url()).pathname, `${route}: redirected to login`).not.toBe("/login");
  await settle(page);

  if (route.startsWith("/recommendations")) {
    await expect(page.getByTestId("klyx-primary-recommendation")).toBeVisible();
    await expect(page.getByTestId("klyx-secondary-options")).toBeVisible();
  }
  if (route === "/bookings") {
    await expect(page.locator('main a[href="/bookings/e2e-action"]')).toBeVisible();
  }

  const hasAssistantShell = await expectDarkAssistantDirection(page, route);
  await screenshot(page, `${snapshot}-${isMobile(testInfo) ? "mobile" : "desktop"}`);
  if (hasAssistantShell) await certifyRail(page, isMobile(testInfo));

  const diagnostics = await collectDiagnostics(page, route);
  await testInfo.attach(`${snapshot}-${isMobile(testInfo) ? "mobile" : "desktop"}-diagnostics.json`, {
    body: Buffer.from(JSON.stringify({ ...diagnostics, runtimeErrors }, null, 2)),
    contentType: "application/json",
  });
  assertHealthy(diagnostics, runtimeErrors);
}

async function installVoiceMock(page: Page) {
  await page.evaluate(() => {
    type Handler = (() => void) | null;
    const state = { starts: 0, stops: 0 };
    class MockSpeechRecognition {
      lang = "";
      interimResults = true;
      continuous = true;
      onstart: Handler = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: Handler = null;
      start() {
        state.starts += 1;
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
    const target = window as typeof window & {
      SpeechRecognition?: typeof MockSpeechRecognition;
      webkitSpeechRecognition?: typeof MockSpeechRecognition;
      __klyxVoiceCertification?: () => { starts: number; stops: number };
    };
    Object.defineProperty(target, "SpeechRecognition", {
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(target, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    target.__klyxVoiceCertification = () => ({ ...state });
  });
}

async function certifyVoice(page: Page) {
  await page.goto("/assistant", { waitUntil: "domcontentloaded" });
  await settle(page);
  await installVoiceMock(page);
  const button = page.locator('form button[aria-pressed]').first();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __klyxVoiceCertification?: () => { starts: number; stops: number };
          }
        ).__klyxVoiceCertification?.().starts
      )
    )
    .toBe(1);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __klyxVoiceCertification?: () => { starts: number; stops: number };
          }
        ).__klyxVoiceCertification?.().stops
      )
    )
    .toBe(1);
}

async function installCameraMock(page: Page) {
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
    if (!context) throw new Error("synthetic camera canvas unavailable");
    context.fillRect(0, 0, 640, 480);
    const source = canvas.captureStream(5);
    const track = source.getVideoTracks()[0];
    if (!track) throw new Error("synthetic camera track unavailable");
    const originalStop = track.stop.bind(track);
    track.stop = () => {
      stops += 1;
      originalStop();
    };
    const stream = new MediaStream([track]);
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
        __klyxCameraCertification?: () => {
          calls: number;
          stops: number;
          constraints: MediaStreamConstraints | null;
        };
      }
    ).__klyxCameraCertification = () => ({ calls, stops, constraints });
  });
}

async function certifyPhoto(page: Page) {
  await page.goto("/request/photo", { waitUntil: "domcontentloaded" });
  await settle(page);
  await installCameraMock(page);
  const start = page.getByRole("button", { name: "Prendre une photo", exact: true });
  await expect(start).toBeVisible();
  await start.click();
  const video = page.getByLabel("Aperçu caméra KLYX");
  await expect(video).toBeVisible();
  const opened = await page.evaluate(() =>
    (
      window as typeof window & {
        __klyxCameraCertification?: () => {
          calls: number;
          stops: number;
          constraints: MediaStreamConstraints | null;
        };
      }
    ).__klyxCameraCertification?.()
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
            __klyxCameraCertification?: () => { calls: number; stops: number };
          }
        ).__klyxCameraCertification?.().stops
      )
    )
    .toBe(1);
}

test.describe("KLYX UX / Visual Certification — assistant-first", () => {
  test.skip(!hasE2ECredentials, "Dedicated KLYX E2E credentials are not configured.");

  test.beforeEach(async ({ page }) => {
    await installDeterministicDarkEnvironment(page);
  });

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("desktop/mobile surfaces are dark, measurable and stable", async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    const runtimeErrors = captureRuntimeErrors(page);

    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await enforceDeterministicDarkEnvironment(page);
    await mockDeterministicMission(page);
    await mockDeterministicRecommendations(page);

    for (const surface of SURFACES) {
      await test.step(surface.snapshot, async () => {
        await certifySurface(page, testInfo, surface.route, surface.snapshot, runtimeErrors);
      });
    }

    await test.step("Compte menu", async () => {
      runtimeErrors.length = 0;
      await page.goto("/assistant", { waitUntil: "domcontentloaded" });
      await settle(page);
      await certifyAccountMenu(page, isMobile(testInfo));
      expect.soft(runtimeErrors, "Compte menu emitted runtime errors").toEqual([]);
    });
  });

  test("Voice and Photo remain functional browser entry points", async ({ page }) => {
    test.setTimeout(180_000);
    const runtimeErrors = captureRuntimeErrors(page);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await enforceDeterministicDarkEnvironment(page);
    await mockDeterministicMission(page);

    runtimeErrors.length = 0;
    await certifyVoice(page);
    expect.soft(runtimeErrors, "Voice emitted runtime errors").toEqual([]);

    runtimeErrors.length = 0;
    await certifyPhoto(page);
    expect.soft(runtimeErrors, "Photo emitted runtime errors").toEqual([]);
  });
});
