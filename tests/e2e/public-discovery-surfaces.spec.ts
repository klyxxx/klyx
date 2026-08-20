import { expect, test } from "@playwright/test";

test.describe("KLYX public discovery surfaces", () => {
  test("public discovery, support and legal routes remain healthy", async ({ page }) => {
    test.setTimeout(180_000);

    for (const route of [
      "/",
      "/search",
      "/providers",
      "/babysitters",
      "/support",
      "/privacy",
      "/terms",
      "/legal",
      "/install",
      "/offline",
      "/beta",
    ] as const) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      if (response) {
        expect(response.status(), `${route} returned a server error`).toBeLessThan(500);
      }

      const current = new URL(page.url());
      expect(current.pathname, `${route} unexpectedly required login`).not.toBe("/login");
    }
  });
});
