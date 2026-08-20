import { expect, test } from "@playwright/test";
import { KLYX_PROTECTED_ROUTES } from "../../lib/auth-routes";

test.describe("KLYX anonymous protected route boundaries", () => {
  for (const route of KLYX_PROTECTED_ROUTES) {
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

  test("protected route preserves its full query string only inside redirect", async ({ page }) => {
    await page.goto("/request?service=menage&source=assistant");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe(
      "/request?service=menage&source=assistant"
    );
    expect(url.searchParams.has("service")).toBe(false);
    expect(url.searchParams.has("source")).toBe(false);
  });

  test("nested protected route preserves its full redirect target", async ({ page }) => {
    await page.goto("/bookings/example-booking?tab=payment");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe(
      "/bookings/example-booking?tab=payment"
    );
    expect(url.searchParams.has("tab")).toBe(false);
  });

  test("public search remains outside the authenticated boundary", async ({ page }) => {
    const response = await page.goto("/search");

    expect(response?.status()).toBeLessThan(500);
    expect(new URL(page.url()).pathname).toBe("/search");
  });

  test("public authentication page remains available anonymously", async ({ page }) => {
    const response = await page.goto("/reset-password");

    expect(response?.status()).toBeLessThan(500);
    expect(new URL(page.url()).pathname).toBe("/reset-password");
  });
});
