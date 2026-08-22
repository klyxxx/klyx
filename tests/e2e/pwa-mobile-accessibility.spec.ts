import { expect, test } from "@playwright/test";

test.describe("KLYX PWA and mobile accessibility", () => {
  test("serves an installable manifest and every declared core icon", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");

    expect(response.ok()).toBeTruthy();

    const manifest = (await response.json()) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      icons?: Array<{
        src?: string;
        sizes?: string;
        purpose?: string;
      }>;
    };

    expect(manifest.name).toContain("KLYX");
    expect(manifest.short_name).toBe("KLYX");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");

    const icons = manifest.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192")).toBeTruthy();
    expect(icons.some((icon) => icon.sizes === "512x512")).toBeTruthy();
    expect(icons.some((icon) => icon.purpose === "maskable")).toBeTruthy();

    for (const icon of icons) {
      if (!icon.src) continue;

      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok()).toBeTruthy();
    }
  });

  test("service worker keeps sensitive routes out of offline handling", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");

    expect(response.ok()).toBeTruthy();

    const source = await response.text();

    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname.startsWith("/auth/")');
    expect(source).toContain('url.pathname.startsWith("/payment/")');
    expect(source).toContain('url.pathname.startsWith("/connect/")');
    expect(source).toContain('caches.match("/offline")');
    expect(source).toContain('request.mode === "navigate"');
  });

  test("offline fallback communicates the sensitive-operation boundary", async ({
    page,
  }) => {
    const response = await page.goto("/offline");

    expect(response?.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", {
        name: "KLYX est temporairement hors ligne.",
      })
    ).toBeVisible();

    await expect(
      page.getByText(
        /Les paiements, réservations, messages et données personnelles ne sont jamais servis depuis un cache hors ligne\./
      )
    ).toBeVisible();
  });

  test("keyboard users can skip directly to the application content", async ({
    page,
  }) => {
    await page.goto("/install");

    const skipLink = page.getByRole("link", {
      name: "Aller au contenu principal",
    });

    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(page.locator("#klyx-main-content")).toBeFocused();
  });

  test("core public surfaces do not overflow a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ["/", "/login", "/install", "/offline"]) {
      await page.goto(route);

      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        dimensions.scrollWidth,
        `${route} should not overflow horizontally on a 390px viewport`
      ).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  });

  test("primary mobile authentication control keeps a touch-friendly target", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    const button = page.getByRole("button", { name: "Se connecter" });
    const box = await button.boundingBox();

    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
