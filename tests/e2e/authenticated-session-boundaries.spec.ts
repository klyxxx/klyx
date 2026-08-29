import { expect, test } from "@playwright/test";

import {
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("KLYX authenticated session boundaries", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test("authenticated users are redirected away from authentication screens", async ({ page }) => {
    test.setTimeout(120_000);
    await loginKlyxE2E(page);

    for (const route of ["/login", "/signup?type=provider", "/reset-password"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 });
    }
  });

  test("authenticated session reaches representative private areas without a login bounce", async ({ page }) => {
    test.setTimeout(120_000);
    await loginKlyxE2E(page);

    for (const route of ["/bookings", "/messages", "/settings"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}(?:\\?|$)`), {
        timeout: 20_000,
      });
    }
  });
});
