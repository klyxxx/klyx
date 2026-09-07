import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function resolve(relativePath: string) {
  return path.join(process.cwd(), relativePath);
}

function read(relativePath: string) {
  return fs.readFileSync(resolve(relativePath), "utf8");
}

function sha256(relativePath: string) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolve(relativePath)))
    .digest("hex");
}

const forbiddenBrandTokens =
  /#7c3aed|#8b5cf6|#5b21b6|violet|indigo|fuchsia|gradient/i;

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

  it("keeps the fallback neutral and on the exact KLYX brand blue", () => {
    const fallback = read("public/klyx-image-fallback.svg");

    expect(fallback).toContain("#2563EB");
    expect(fallback).not.toMatch(forbiddenBrandTokens);
  });

  it("removes the legacy purple identity from public browser icons", () => {
    const icon = read("public/icon.svg");
    const appleIcon = read("public/apple-icon.svg");

    expect(icon).toMatch(/#2563eb/i);
    expect(appleIcon).toMatch(/#2563eb/i);
    expect(icon).not.toMatch(forbiddenBrandTokens);
    expect(appleIcon).not.toMatch(forbiddenBrandTokens);
  });

  it("pins every binary install icon to the reviewed KLYX brand assets", () => {
    const expectedHashes: Record<string, string> = {
      "public/icons/icon-192.png":
        "e92e68c0e3bcbb6ac040db8edc80a7c51bbf06502eb59aee60d690438af5917a",
      "public/icons/icon-512.png":
        "7f851cd36599b39ecec00c3bfeeb5cd9d8dafdb5c458ee38af8604859521b265",
      "public/icons/icon-maskable-512.png":
        "783f93fdfb02c0516848f4a431d829a0f70791d7eb115b37a74f1204b2d4561d",
      "public/icons/apple-touch-icon.png":
        "263df6f7b103de2ede88b0f6008dc8f1bfebc88d895fb2a467b5a74cc2c048df",
      "app/favicon.ico":
        "9c6d4d9858153a5b21016dc5d60f8da4bab74190d2e826d8ca59a4a197ef892a",
    };

    for (const [asset, expectedHash] of Object.entries(expectedHashes)) {
      expect(sha256(asset), asset).toBe(expectedHash);
    }
  });

  it("publishes brand-safe social images from the canonical KLYX origin", () => {
    const layout = read("app/layout.tsx");
    const card = read("app/components/KlyxSocialCard.tsx");
    const openGraphImage = read("app/opengraph-image.tsx");
    const twitterImage = read("app/twitter-image.tsx");

    expect(layout).toContain('const appUrl = "https://www.klyx.be"');
    expect(layout).not.toContain('"http://localhost:3000"');
    expect(card).toContain("#2563EB");
    expect(card).not.toMatch(forbiddenBrandTokens);
    expect(openGraphImage).toContain("width: 1200");
    expect(openGraphImage).toContain("height: 630");
    expect(twitterImage).toContain("width: 1200");
    expect(twitterImage).toContain("height: 630");
  });
});
