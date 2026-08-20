import { expect, test } from "@playwright/test";

test.describe("KLYX privileged boundaries", () => {
  test("anonymous visitors cannot open admin or founder pages", async ({ page }) => {
    for (const route of ["/admin", "/founder"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?redirect=${encodeURIComponent(route).replace(/%/g, "%")}`)
      );
    }
  });

  test("anonymous requests cannot read privileged health or founder state", async ({ request }) => {
    for (const route of [
      "/api/admin/access",
      "/api/admin/openai-health",
      "/api/admin/stripe-readiness",
      "/api/admin/stripe-webhook-health",
      "/api/founder/status",
      "/api/founder/accounts-audit",
      "/api/founder/transaction-readiness",
    ] as const) {
      const response = await request.get(route);
      expect([401, 403], `${route} exposed privileged state`).toContain(response.status());
    }
  });
});
