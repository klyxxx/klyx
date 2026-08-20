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
  }
);
