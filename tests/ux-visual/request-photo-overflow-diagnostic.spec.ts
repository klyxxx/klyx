import { expect, test } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  hasE2ECredentials,
  loginKlyxE2E,
} from "../e2e/helpers/authenticated-session";

test.describe("temporary request/photo overflow diagnostic", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are required for UX diagnostics."
  );

  test("identifies the desktop node extending the document", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "desktop diagnostic only");
    test.setTimeout(120_000);

    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await page.goto("/request/photo", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const diagnostic = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const viewportWidth = window.innerWidth;
      const elements = Array.from(body.querySelectorAll<HTMLElement>("*"));

      const boxes = elements
        .map((element) => {
          const style = getComputedStyle(element);
          if (style.display === "none") return null;
          const rect = element.getBoundingClientRect();
          if (
            rect.right <= viewportWidth + 1 &&
            rect.left >= -1 &&
            element.scrollWidth <= element.clientWidth + 1
          ) {
            return null;
          }

          const id = element.id ? `#${element.id}` : "";
          const classes = Array.from(element.classList).slice(0, 8).join(".");
          const before = getComputedStyle(element, "::before");
          const after = getComputedStyle(element, "::after");

          return {
            node: `${element.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ""}`,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            position: style.position,
            overflowX: style.overflowX,
            transform: style.transform,
            visibility: style.visibility,
            whiteSpace: style.whiteSpace,
            before: {
              content: before.content,
              width: before.width,
              position: before.position,
              transform: before.transform,
            },
            after: {
              content: after.content,
              width: after.width,
              position: after.position,
              transform: after.transform,
            },
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .sort((a, b) => b.right - a.right)
        .slice(0, 20);

      const originalX = window.scrollX;
      window.scrollTo(root.scrollWidth, window.scrollY);
      const reachable = window.scrollX - originalX;
      window.scrollTo(originalX, window.scrollY);

      function box(selector: string) {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          selector,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowX: getComputedStyle(element).overflowX,
        };
      }

      return {
        viewportWidth,
        rootScrollWidth: root.scrollWidth,
        rootClientWidth: root.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        bodyClientWidth: body.clientWidth,
        reachable,
        structural: [
          box("html"),
          box("body"),
          box(".klyx-app-shell"),
          box('[data-testid="desktop-mission-rail"]'),
          box(".klyx-app-content"),
          box("#klyx-main-content"),
          box("#klyx-main-content main"),
        ],
        boxes,
      };
    });

    expect(
      diagnostic.reachable,
      `REQUEST_PHOTO_OVERFLOW_DIAGNOSTIC ${JSON.stringify(diagnostic)}`
    ).toBeLessThanOrEqual(1);
  });
});
