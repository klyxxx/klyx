import { expect, test } from "@playwright/test";

for (const route of ["/login", "/"]) {
  test(`${route} loads without server failure`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
}

test("health survives platform browser and network resumes after a cut", async ({ page, context, request }) => {
  const initial = await request.get("/api/health");
  expect(initial.ok()).toBe(true);

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await context.setOffline(true);

  let offlineFailed = false;
  try {
    await page.goto("/api/health", { waitUntil: "domcontentloaded", timeout: 3_000 });
  } catch {
    offlineFailed = true;
  }
  expect(offlineFailed).toBe(true);

  await context.setOffline(false);
  const recovered = await page.goto("/api/health", { waitUntil: "domcontentloaded" });
  expect(recovered?.ok()).toBe(true);

  const login = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(login?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});

test("responsive shell does not require a desktop viewport", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.innerWidth).toBeGreaterThan(0);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 4);
});
