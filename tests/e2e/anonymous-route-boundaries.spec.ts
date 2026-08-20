import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/accounts",
  "/bookings",
  "/brain",
  "/dashboard",
  "/favorites",
  "/memory",
  "/messages",
  "/notifications",
  "/profile",
  "/request",
  "/reviews",
  "/settings",
] as const;

test.describe("KLYX anonymous protected route boundaries", () => {
  for (const route of protectedRoutes) {
    test(`${route} redirects anonymous visitors to login`, async ({ page }) => {
      await page.goto(route);

      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("redirect")).toBe(route);

      await expect(
        page.getByRole("heading", { name: "Connexion à KLYX" })
      ).toBeVisible();
    });
  }

  test("protected route keeps its query string in the post-login destination", async ({ page }) => {
    await page.goto("/bookings?status=pending");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/bookings?status=pending");
  });
});
