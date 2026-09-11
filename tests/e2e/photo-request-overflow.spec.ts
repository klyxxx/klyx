import { expect, test, type Page } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

type OverflowCandidate = {
  element: string;
  x: number;
  right: number;
  width: number;
  clientWidth: number;
  scrollWidth: number;
  scrollRight: number;
  spill: number;
  display: string;
  position: string;
  overflowX: string;
  minWidth: string;
  maxWidth: string;
};

type ElementMetrics = {
  element: string;
  x: number;
  right: number;
  width: number;
  clientWidth: number;
  offsetWidth: number;
  scrollWidth: number;
  display: string;
  position: string;
  overflowX: string;
  minWidth: string;
  maxWidth: string;
  transform: string;
};

type PseudoMetrics = {
  element: string;
  pseudo: "::before" | "::after";
  content: string;
  display: string;
  position: string;
  width: string;
  minWidth: string;
  maxWidth: string;
  left: string;
  right: string;
  inset: string;
  transform: string;
};

type IsolationEntry = {
  depth: number;
  element: string;
  baselineWidth: number;
  widthWithoutElement: number;
  reduction: number;
};

type OverflowReport = {
  viewport: {
    clientWidth: number;
    clientHeight: number;
    innerWidth: number;
    innerHeight: number;
  };
  document: {
    scrollWidth: number;
    scrollHeight: number;
    bodyScrollWidth: number;
    bodyClientWidth: number;
  };
  rootMetrics: ElementMetrics;
  bodyMetrics: ElementMetrics;
  candidates: OverflowCandidate[];
  pseudoElements: PseudoMetrics[];
  isolationPath: IsolationEntry[];
};

type MobileShellReport = {
  viewport: { width: number; height: number };
  inner: { width: number; height: number };
  header: { x: number; y: number; width: number; height: number } | null;
  menuButton: { x: number; y: number; width: number; height: number } | null;
  dialog: { x: number; y: number; width: number; height: number } | null;
};

async function openPhotoRequest(page: Page) {
  await page.goto("/request/photo", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Montre-moi ce qu’il faut faire." })
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    window.scrollTo(0, 0);
  });
}

async function collectOverflowReport(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;

    function labelFor(element: HTMLElement) {
      const label =
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent ||
        "";
      return label.replace(/\s+/g, " ").trim().slice(0, 72);
    }

    function describe(element: HTMLElement) {
      const id = element.id ? `#${element.id}` : "";
      const testId = element.getAttribute("data-testid");
      const testSuffix = testId ? `[data-testid=\"${testId}\"]` : "";
      const label = labelFor(element);
      return `${element.tagName.toLowerCase()}${id}${testSuffix}${label ? ` \"${label}\"` : ""}`;
    }

    function visible(element: HTMLElement) {
      if (element.hidden || element.closest('[hidden], [aria-hidden="true"]')) return false;
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

    function metrics(element: HTMLElement): ElementMetrics {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        element: describe(element),
        x: Math.round(rect.x),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        clientWidth: element.clientWidth,
        offsetWidth: element.offsetWidth,
        scrollWidth: element.scrollWidth,
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        transform: style.transform,
      };
    }

    const candidates = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        if (!visible(element)) return false;
        if (
          element instanceof HTMLAnchorElement &&
          element.getAttribute("href")?.startsWith("#") &&
          !element.matches(":focus, :focus-visible")
        ) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        const scrollRight = rect.left + element.scrollWidth;
        return (
          rect.left < -2 ||
          rect.right > viewportWidth + 2 ||
          scrollRight > viewportWidth + 2 ||
          (element.scrollWidth > element.clientWidth + 2 &&
            element.scrollWidth > viewportWidth + 2)
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const scrollRight = rect.left + element.scrollWidth;
        const spill = Math.max(
          0,
          -rect.left,
          rect.right - viewportWidth,
          scrollRight - viewportWidth
        );

        return {
          element: describe(element),
          x: Math.round(rect.x),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          scrollRight: Math.round(scrollRight),
          spill: Math.round(spill),
          display: style.display,
          position: style.position,
          overflowX: style.overflowX,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
        };
      })
      .sort((left, right) => right.spill - left.spill)
      .slice(0, 30);

    const pseudoElements: PseudoMetrics[] = [];
    for (const element of [root, document.body, ...Array.from(document.querySelectorAll<HTMLElement>("body *"))]) {
      for (const pseudo of ["::before", "::after"] as const) {
        const style = getComputedStyle(element, pseudo);
        if (
          style.content === "none" ||
          style.content === "normal" ||
          style.display === "none"
        ) {
          continue;
        }
        pseudoElements.push({
          element: describe(element),
          pseudo,
          content: style.content,
          display: style.display,
          position: style.position,
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          left: style.left,
          right: style.right,
          inset: style.inset,
          transform: style.transform,
        });
      }
    }

    function hideAndMeasure(element: HTMLElement) {
      const previousStyle = element.getAttribute("style");
      element.style.setProperty("display", "none", "important");
      const width = root.scrollWidth;
      if (previousStyle === null) {
        element.removeAttribute("style");
      } else {
        element.setAttribute("style", previousStyle);
      }
      void element.offsetWidth;
      return width;
    }

    const isolationPath: IsolationEntry[] = [];
    let currentParent: HTMLElement = document.body;
    let baselineWidth = root.scrollWidth;

    for (let depth = 0; depth < 6 && baselineWidth > root.clientWidth + 2; depth += 1) {
      const children = Array.from(currentParent.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement
      );
      let best:
        | { element: HTMLElement; widthWithoutElement: number; reduction: number }
        | undefined;

      for (const child of children) {
        const widthWithoutElement = hideAndMeasure(child);
        const reduction = baselineWidth - widthWithoutElement;
        if (reduction > 2 && (!best || reduction > best.reduction)) {
          best = { element: child, widthWithoutElement, reduction };
        }
      }

      if (!best) break;

      isolationPath.push({
        depth,
        element: describe(best.element),
        baselineWidth,
        widthWithoutElement: best.widthWithoutElement,
        reduction: best.reduction,
      });
      currentParent = best.element;
      baselineWidth = root.scrollWidth;
    }

    return {
      viewport: {
        clientWidth: root.clientWidth,
        clientHeight: root.clientHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      },
      document: {
        scrollWidth: root.scrollWidth,
        scrollHeight: root.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
      },
      rootMetrics: metrics(root),
      bodyMetrics: metrics(document.body),
      candidates,
      pseudoElements: pseudoElements.slice(0, 80),
      isolationPath,
    };
  });
}

function logOverflowReport(label: string, report: OverflowReport) {
  console.log(`KLYX_PHOTO_OVERFLOW_${label}=${JSON.stringify(report)}`);
}

async function collectMobileShellReport(page: Page): Promise<MobileShellReport> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright viewport is unavailable");

  const header = page.getByTestId("assistant-shell-mobile-header");
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox();

  const menu = page.getByTestId("assistant-shell-mobile-menu");
  const menuBox = await menu.boundingBox();
  await menu.evaluate((element: HTMLElement) => element.click());

  const dialog = page.getByRole("dialog", { name: "KLYX" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();

  const inner = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  return {
    viewport,
    inner,
    header: headerBox,
    menuButton: menuBox,
    dialog: dialogBox,
  };
}

test.describe("KLYX photo request viewport containment", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("stays inside desktop and 390x844 mobile viewports", async ({ page }) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPhotoRequest(page);
    const desktopReport = await collectOverflowReport(page);
    logOverflowReport("DESKTOP", desktopReport);

    await page.setViewportSize({ width: 390, height: 844 });
    await openPhotoRequest(page);
    const mobileReport = await collectOverflowReport(page);
    logOverflowReport("MOBILE", mobileReport);

    const shellReport = await collectMobileShellReport(page);
    console.log(`KLYX_PHOTO_SHELL_MOBILE=${JSON.stringify(shellReport)}`);

    expect.soft(
      desktopReport.document.scrollWidth,
      "DESKTOP: /request/photo must not create horizontal document overflow"
    ).toBeLessThanOrEqual(desktopReport.viewport.clientWidth + 2);

    expect.soft(
      mobileReport.document.scrollWidth,
      "MOBILE: /request/photo must not create horizontal document overflow"
    ).toBeLessThanOrEqual(mobileReport.viewport.clientWidth + 2);

    expect(shellReport.header).not.toBeNull();
    expect.soft(
      shellReport.header!.x + shellReport.header!.width,
      "Mobile KLYX header must stay inside the 390px viewport"
    ).toBeLessThanOrEqual(shellReport.viewport.width + 1);

    expect(shellReport.menuButton).not.toBeNull();
    expect.soft(
      shellReport.menuButton!.x + shellReport.menuButton!.width,
      "Mobile KLYX menu button must stay inside the 390px viewport"
    ).toBeLessThanOrEqual(shellReport.viewport.width + 1);

    expect(shellReport.dialog).not.toBeNull();
    expect.soft(
      shellReport.dialog!.x + shellReport.dialog!.width,
      "Mobile KLYX drawer must stay inside the viewport width"
    ).toBeLessThanOrEqual(shellReport.viewport.width + 1);
    expect.soft(
      shellReport.dialog!.y + shellReport.dialog!.height,
      "Mobile KLYX drawer must stay inside the viewport height"
    ).toBeLessThanOrEqual(shellReport.viewport.height + 1);
  });
});
