import {
  expect,
  test,
} from "@playwright/test";

test.describe(
  "KLYX authentication redirects",
  () => {
    test(
      "nested private route preserves its full redirect target",
      async ({ page }) => {
        await page.goto(
          "/bookings/example-booking?tab=payment"
        );

        await expect(page).toHaveURL(
          /\/login\?redirect=%2Fbookings%2Fexample-booking%3Ftab%3Dpayment$/
        );
      }
    );

    test(
      "request query parameters survive the authentication boundary",
      async ({ page }) => {
        await page.goto(
          "/request?service=menage&source=assistant"
        );

        const currentUrl =
          new URL(page.url());

        expect(currentUrl.pathname).toBe(
          "/login"
        );

        expect(
          currentUrl.searchParams.get(
            "redirect"
          )
        ).toBe(
          "/request?service=menage&source=assistant"
        );
      }
    );

    test(
      "public authentication page remains available anonymously",
      async ({ page }) => {
        const response =
          await page.goto(
            "/reset-password"
          );

        expect(
          response?.status()
        ).toBeLessThan(500);

        expect(
          new URL(page.url()).pathname
        ).toBe(
          "/reset-password"
        );
      }
    );
  }
);
