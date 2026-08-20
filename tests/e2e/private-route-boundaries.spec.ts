import {
  expect,
  test,
} from "@playwright/test";

const protectedRoutes = [
  "/accounts",
  "/book",
  "/bookings",
  "/brain",
  "/connect",
  "/create-store",
  "/dashboard",
  "/favorites",
  "/memory",
  "/messages",
  "/notifications",
  "/payment",
  "/profile",
  "/projects",
  "/request",
  "/reviews",
  "/scores",
  "/settings",
  "/tracking",
] as const;

test.describe(
  "KLYX private route boundaries",
  () => {
    for (const route of protectedRoutes) {
      test(
        `anonymous visitor is redirected from ${route}`,
        async ({ page }) => {
          await page.goto(route);

          const expectedRedirect =
            encodeURIComponent(route);

          await expect(page).toHaveURL(
            new RegExp(
              `/login\\?redirect=${expectedRedirect}$`
            )
          );

          await expect(
            page.getByRole("heading", {
              name: "Connexion à KLYX",
            })
          ).toBeVisible();
        }
      );
    }

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
  }
);
