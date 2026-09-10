import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export type UxDiagnostics = {
  route: string;
  viewport: { width: number; height: number };
  document: {
    clientWidth: number;
    scrollWidth: number;
    clientHeight: number;
    scrollHeight: number;
  };
  horizontalOverflow: boolean;
  outOfViewport: string[];
  fixedOrStickyOutOfViewport: string[];
  blockedInteractives: string[];
  overlappingInteractives: string[];
  mainVisible: boolean;
  longContentScrollable: boolean;
};

function accountEntryCount(rail: Locator) {
  return rail.locator("details").evaluateAll((details) =>
    details.filter((detailsElement) => {
      const profile = detailsElement.querySelector('a[href="/profile"]');
      const settings = detailsElement.querySelector('a[href="/settings"]');
      const accounts = detailsElement.querySelector('a[href="/accounts"]');
      return Boolean(profile && settings && accounts);
    }).length
  );
}

export async function settleVisualPage(page: Page) {
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    window.scrollTo(0, 0);
  });
}

export async function collectUxDiagnostics(
  page: Page,
  route: string
): Promise<UxDiagnostics> {
  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const root = document.documentElement;

    function describe(element: HTMLElement) {
      const label = (
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent ||
        element.getAttribute("name") ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);
      const id = element.id ? `#${element.id}` : "";
      return `${element.tagName.toLowerCase()}${id}${label ? ` \"${label}\"` : ""}`;
    }

    function isVisible(element: HTMLElement) {
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

    function isDisabled(element: HTMLElement) {
      return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";
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
    ).filter(isVisible);

    const outOfViewport = interactives
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -2 || rect.right > viewportWidth + 2;
      })
      .slice(0, 30)
      .map(describe);

    const fixedOrStickyOutOfViewport = Array.from(
      document.querySelectorAll<HTMLElement>("body *")
    )
      .filter((element) => {
        if (!isVisible(element)) return false;
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
      .map(describe);

    const inViewport = interactives.filter((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.bottom > 0 &&
        rect.top < viewportHeight &&
        rect.right > 0 &&
        rect.left < viewportWidth
      );
    });

    const blockedInteractives = inViewport
      .filter((element) => {
        if (isDisabled(element)) return false;
        const style = getComputedStyle(element);
        if (style.pointerEvents === "none") return true;
        const rect = element.getBoundingClientRect();
        const x = Math.min(viewportWidth - 1, Math.max(0, rect.left + rect.width / 2));
        const y = Math.min(viewportHeight - 1, Math.max(0, rect.top + rect.height / 2));
        const hit = document.elementFromPoint(x, y);
        return !hit || !(hit === element || element.contains(hit));
      })
      .slice(0, 30)
      .map(describe);

    const overlapCandidates = inViewport
      .filter((element) => !isDisabled(element))
      .slice(0, 120);
    const overlappingInteractives: string[] = [];

    for (let leftIndex = 0; leftIndex < overlapCandidates.length; leftIndex += 1) {
      const left = overlapCandidates[leftIndex];
      const leftRect = left.getBoundingClientRect();

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < overlapCandidates.length;
        rightIndex += 1
      ) {
        const right = overlapCandidates[rightIndex];
        if (left.contains(right) || right.contains(left)) continue;

        const rightRect = right.getBoundingClientRect();
        const width = Math.max(
          0,
          Math.min(leftRect.right, rightRect.right) -
            Math.max(leftRect.left, rightRect.left)
        );
        const height = Math.max(
          0,
          Math.min(leftRect.bottom, rightRect.bottom) -
            Math.max(leftRect.top, rightRect.top)
        );
        if (width <= 4 || height <= 4) continue;

        const intersection = width * height;
        const smallerArea = Math.min(
          leftRect.width * leftRect.height,
          rightRect.width * rightRect.height
        );
        if (smallerArea <= 0 || intersection / smallerArea < 0.4) continue;

        overlappingInteractives.push(`${describe(left)} <> ${describe(right)}`);
        if (overlappingInteractives.length >= 30) break;
      }

      if (overlappingInteractives.length >= 30) break;
    }

    const main = document.querySelector<HTMLElement>("main");
    const mainRect = main?.getBoundingClientRect();
    const mainVisible = Boolean(
      main &&
        mainRect &&
        mainRect.width > 1 &&
        mainRect.height > 1 &&
        mainRect.right > 0 &&
        mainRect.left < viewportWidth
    );

    return {
      viewport: { width: viewportWidth, height: viewportHeight },
      document: {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight,
      },
      horizontalOverflow: root.scrollWidth > root.clientWidth + 2,
      outOfViewport,
      fixedOrStickyOutOfViewport,
      blockedInteractives,
      overlappingInteractives,
      mainVisible,
    };
  });

  const longContentScrollable = await page.evaluate(async () => {
    const root = document.scrollingElement;
    if (!root) return true;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    if (maxScroll <= 2) return true;

    const before = root.scrollTop;
    root.scrollTop = maxScroll;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const reachedBottom = Math.abs(root.scrollTop - maxScroll) <= 3;
    root.scrollTop = before;
    return reachedBottom;
  });

  return {
    route,
    ...metrics,
    longContentScrollable,
  };
}

export async function attachUxDiagnostics(
  testInfo: TestInfo,
  name: string,
  diagnostics: UxDiagnostics,
  consoleErrors: readonly string[]
) {
  await testInfo.attach(`${name}-diagnostics.json`, {
    body: Buffer.from(
      JSON.stringify(
        {
          ...diagnostics,
          consoleErrors,
        },
        null,
        2
      )
    ),
    contentType: "application/json",
  });
}

export function expectHealthyUxDiagnostics(
  diagnostics: UxDiagnostics,
  consoleErrors: readonly string[]
) {
  expect.soft(
    diagnostics.horizontalOverflow,
    `${diagnostics.route}: horizontal overflow`
  ).toBe(false);
  expect.soft(
    diagnostics.outOfViewport,
    `${diagnostics.route}: visible interactive element outside horizontal viewport`
  ).toEqual([]);
  expect.soft(
    diagnostics.fixedOrStickyOutOfViewport,
    `${diagnostics.route}: fixed/sticky element outside viewport`
  ).toEqual([]);
  expect.soft(
    diagnostics.blockedInteractives,
    `${diagnostics.route}: visible enabled interactive is blocked/non-interactive`
  ).toEqual([]);
  expect.soft(
    diagnostics.overlappingInteractives,
    `${diagnostics.route}: interactive components overlap`
  ).toEqual([]);
  expect.soft(
    diagnostics.mainVisible,
    `${diagnostics.route}: main content is inaccessible`
  ).toBe(true);
  expect.soft(
    diagnostics.longContentScrollable,
    `${diagnostics.route}: long content cannot be scrolled to the end`
  ).toBe(true);
  expect.soft(
    consoleErrors,
    `${diagnostics.route}: console/page errors`
  ).toEqual([]);
}

export async function certifyMissionRail(
  page: Page,
  mobile: boolean
) {
  const viewport = page.viewportSize();
  expect(viewport, "Viewport must be measurable").not.toBeNull();

  if (mobile) {
    await expect(page.getByTestId("desktop-mission-rail")).toBeHidden();
    const header = page.getByTestId("assistant-shell-mobile-header");
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.x).toBeGreaterThanOrEqual(-1);
    expect(headerBox!.y).toBeGreaterThanOrEqual(-1);
    expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(viewport!.width + 1);

    await page.getByTestId("assistant-shell-mobile-menu").click();
    const dialog = page.getByRole("dialog", { name: "KLYX" });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(-1);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(-1);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height + 1);

    const rail = dialog.getByTestId("mobile-mission-rail");
    await expect(rail).toBeVisible();
    expect(
      await accountEntryCount(rail),
      "Mobile mission rail must expose exactly one structural Account entry"
    ).toBe(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    return;
  }

  const rail = page.getByTestId("desktop-mission-rail");
  await expect(rail).toBeVisible();
  const railBox = await rail.boundingBox();
  expect(railBox).not.toBeNull();
  expect(railBox!.x).toBeCloseTo(0, 0);
  expect(railBox!.y).toBeCloseTo(0, 0);
  expect(railBox!.width).toBeGreaterThanOrEqual(240);
  expect(railBox!.width).toBeLessThanOrEqual(264);
  expect(railBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2);
  expect(railBox!.height).toBeLessThanOrEqual(viewport!.height + 2);

  const appContent = page.locator(".klyx-app-content");
  await expect(appContent).toBeVisible();
  const contentBox = await appContent.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(
    contentBox!.x,
    "Desktop content must start at or after the mission rail edge"
  ).toBeGreaterThanOrEqual(railBox!.x + railBox!.width - 1);

  expect(
    await accountEntryCount(rail),
    "Desktop mission rail must expose exactly one structural Account entry"
  ).toBe(1);
}

export async function expectReferenceScreenshot(
  page: Page,
  name: string
) {
  const masks = [
    page.locator('[data-testid="account-switcher"]'),
    page.locator('[data-testid="desktop-mission-rail"] section'),
    page.locator('[data-testid="mobile-mission-rail"] section'),
    page.locator("main time"),
    page.locator("main img"),
  ];

  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    fullPage: false,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    mask: masks,
  });
}
