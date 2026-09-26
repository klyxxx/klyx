import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX web/mobile resume contract", () => {
  it("keeps sensitive operations out of offline cache and exposes a deterministic resume boundary", () => {
    const serviceWorker = source("public/sw.js");
    const offlinePage = source("app/offline/page.tsx");

    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/payment/")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/connect/")');
    expect(serviceWorker).toContain('caches.match("/offline")');

    expect(offlinePage).toContain("KLYX est temporairement hors ligne");
    expect(offlinePage).toMatch(/reconnexion|connexion|réessayer|recharger/i);
  });

  it("mobile certification runs the same resume boundary on Android Chromium and iOS WebKit", () => {
    const config = source("playwright.mobile-certification.config.ts");

    expect(config).toContain('devices["Pixel 5"]');
    expect(config).toContain('devices["iPhone 13"]');
    expect(config).toContain('testMatch: "**/pwa-mobile-accessibility.spec.ts"');
  });
});
