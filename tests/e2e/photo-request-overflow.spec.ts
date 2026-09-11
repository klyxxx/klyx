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
  };
  candidates: OverflowCandidate[];
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
      const label = labelFor(element);
      return `${element.tagName.toLowerCase()}${id}${label ? ` \"${label}\"` : ""}`;
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
      },
      candidates,
    };
  });
}

async function expectContainedPhotoRequest(page: Page, label: string) {
  const report = await collectOverflowReport(page);
  console.log(`KLYX_PHOTO_OVERFLOW_${label}=${JSON.stringify(report)}`);

  expect(
    report.document.scrollWidth,
    `${label}: /request/photo must not create horizontal document overflow`
  ).toBeLessThanOrEqual(report.viewport.clientWidth + 2);

  return report;
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
    await expectContainedPhotoRequest(page, "DESKTOP");

    await page.setViewportSize({ width: 390, height: 844 });
    await openPhotoRequest(page);
    const mobileReport = await expectContainedPhotoRequest(page, "MOBILE");

    const header = page.getByTestId("assistant-shell-mobile-header");
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(
      headerBox!.x + headerBox!.width,
      "Mobile KLYX header must stay inside the 390px viewport"
    ).toBeLessThanOrEqual(mobileReport.viewport.clientWidth + 1);

    const menu = page.getByTestId("assistant-shell-mobile-menu");
    await menu.evaluate((element: HTMLElement) => element.click());

    const dialog = page.getByRole("dialog", { name: "KLYX" });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(
      dialogBox!.x + dialogBox!.width,
      "Mobile KLYX drawer must stay inside the viewport width"
    ).toBeLessThanOrEqual(mobileReport.viewport.clientWidth + 1);
    expect(
      dialogBox!.y + dialogBox!.height,
      "Mobile KLYX drawer must stay inside the viewport height"
    ).toBeLessThanOrEqual(mobileReport.viewport.clientHeight + 1);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
