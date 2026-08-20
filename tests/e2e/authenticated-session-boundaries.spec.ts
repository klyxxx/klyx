import { expect, test, type Page } from "@playwright/test";

const email = process.env.KLYX_E2E_EMAIL?.trim();
const password = process.env.KLYX_E2E_PASSWORD;

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

async function clearSensitivePassword(page: Page) {
  try {
    await page.locator('input[type="password"]').evaluateAll((inputs) => {
      for (const input of inputs) {
        const element = input as HTMLInputElement;
        element.value = "";
        element.removeAttribute("value");
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  } catch {
    // The password field can already be gone after navigation.
  }
}

async function login(page: Page) {
  await page.goto("/login");

  await page.getByPlaceholder("vous@exemple.com").fill(email!);
  await page.getByPlaceholder("Votre mot de passe").fill(password!);

  try {
    await page.getByRole("button", { name: "Se connecter" }).click();
  } finally {
    await clearSensitivePassword(page);
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 });
}

test.describe("KLYX authenticated session boundaries", () => {
  test.skip(
    !email || !password,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("authenticated users are redirected away from authentication screens", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    for (const route of ["/login", "/signup?type=provider", "/reset-password"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 });
    }
  });

  test("authenticated session reaches representative private areas without a login bounce", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    for (const route of ["/bookings", "/messages", "/settings"] as const) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}(?:\\?|$)`), {
        timeout: 20_000,
      });
    }
  });
});
