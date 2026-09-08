import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX image integrity contract", () => {
  it("makes the shared image primitive fail soft and privacy-safe", () => {
    const image = read("app/components/KlyxImage.tsx");

    expect(image).toContain(
      'const DEFAULT_FALLBACK_SRC = "/klyx-image-fallback.svg"'
    );
    expect(image).toContain('data-klyx-managed-image="true"');
    expect(image).toContain(
      'referrerPolicy={referrerPolicy ?? "no-referrer"}'
    );
    expect(image).toContain("effectiveFallbackSrc");
    expect(image).toContain('src.endsWith(".svg")');
  });

  it("protects legacy raw images across the mounted application", () => {
    const guard = read("app/components/KlyxImageGuard.tsx");
    const layout = read("app/layout.tsx");

    expect(layout).toContain(
      'import KlyxImageGuard from "@/app/components/KlyxImageGuard"'
    );
    expect(layout).toContain("<KlyxImageGuard />");
    expect(guard).toContain('image.referrerPolicy = "no-referrer"');
    expect(guard).toContain("image.complete && image.naturalWidth === 0");
    expect(guard).toContain(
      'window.addEventListener("error", handleError, true)'
    );
    expect(guard).toContain("MutationObserver");
    expect(guard).toContain("KLYX_FALLBACK_SRC");
  });

  it("keeps every text-based public image on the exact KLYX brand", () => {
    const fallback = read("public/klyx-image-fallback.svg");
    const icon = read("public/icon.svg");
    const appleIcon = read("public/apple-icon.svg");
    const openGraph = read("app/opengraph-image.tsx");
    const twitter = read("app/twitter-image.tsx");
    const combined = [fallback, icon, appleIcon, openGraph, twitter].join("\n");

    expect(combined).toMatch(/#2563EB/i);
    expect(combined).not.toMatch(/#7c3aed|#8b5cf6|#5b21b6|violet|indigo|fuchsia|linearGradient/i);
  });

  it("uses the real public KLYX origin for social metadata fallbacks", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain('"https://www.klyx.be"');
    expect(layout).not.toContain('"http://localhost:3000"');
  });
});
