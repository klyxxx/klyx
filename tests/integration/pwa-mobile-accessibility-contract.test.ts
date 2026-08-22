import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const layout = readRepoFile("app/layout.tsx");
const skipLink = readRepoFile("app/components/KlyxSkipLink.tsx");
const manifest = readRepoFile("app/manifest.ts");
const registrar = readRepoFile("app/components/PwaRegistrar.tsx");
const serviceWorker = readRepoFile("public/sw.js");
const accessibility = readRepoFile("app/klyx-accessibility.css");
const offlinePage = readRepoFile("app/offline/page.tsx");

describe("KLYX PWA and mobile accessibility contract", () => {
  it("connects the installable metadata, service worker and application icons", () => {
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
    expect(layout).toContain("<PwaRegistrar />");
    expect(registrar).toContain('navigator.serviceWorker.register("/sw.js", { scope: "/" })');

    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('start_url: "/"');
    expect(manifest).toContain('scope: "/"');
    expect(manifest).toContain('src: "/icons/icon-192.png"');
    expect(manifest).toContain('src: "/icons/icon-512.png"');
    expect(manifest).toContain('src: "/icons/icon-maskable-512.png"');
    expect(manifest).toContain('purpose: "maskable"');
  });

  it("keeps offline behavior network-first for navigation and out of sensitive routes", () => {
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(serviceWorker).toContain("fetch(request)");
    expect(serviceWorker).toContain('caches.match("/offline")');

    for (const route of ["/api/", "/auth/", "/payment/", "/connect/"]) {
      expect(serviceWorker).toContain(`url.pathname.startsWith("${route}")`);
    }

    expect(offlinePage).toContain(
      "Les paiements, réservations, messages et données"
    );
    expect(offlinePage).toContain(
      "personnelles ne sont jamais servis depuis un cache"
    );
  });

  it("provides a first-focus localized skip link and a stable focusable content target", () => {
    expect(layout).toContain("<KlyxSkipLink />");
    expect(skipLink).toContain('href="#klyx-main-content"');
    expect(skipLink).toContain('t("skipToMain")');
    expect(layout).toContain('id="klyx-main-content"');
    expect(layout).toContain("tabIndex={-1}");
    expect(accessibility).toContain(".klyx-skip-link:focus-visible");
    expect(accessibility).toContain("transform: translateY(0)");
  });

  it("protects visible keyboard focus across native interactive controls", () => {
    expect(accessibility).toContain(":focus-visible");
    expect(accessibility).toContain("outline: 3px solid var(--ring)");
    expect(accessibility).toContain("outline-offset: 3px");
    expect(accessibility).toContain('[role="button"]');
    expect(accessibility).toContain("[tabindex]");
  });

  it("respects reduced-motion preferences globally", () => {
    expect(accessibility).toContain("@media (prefers-reduced-motion: reduce)");
    expect(accessibility).toContain("animation-duration: 0.01ms !important");
    expect(accessibility).toContain("animation-iteration-count: 1 !important");
    expect(accessibility).toContain("transition-duration: 0.01ms !important");
    expect(accessibility).toContain("scroll-behavior: auto !important");
  });
});
