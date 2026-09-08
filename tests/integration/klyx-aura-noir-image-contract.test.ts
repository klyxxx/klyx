import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX Aura Noir image contract", () => {
  it("keeps one resilient premium media primitive for dynamic imagery", () => {
    const image = read("app/components/KlyxImage.tsx");

    expect(image).toContain('"use client"');
    expect(image).toContain('from "next/image"');
    expect(image).toContain("quality = 92");
    expect(image).toContain("fallbackSrc");
    expect(image).toContain("shouldBypassNextOptimization");
    expect(image).toContain("https?:\\/\\/");
    expect(image).toContain("blob:");
    expect(image).toContain("data:");
    expect(image).toContain("unoptimized ??");
  });

  it("switches theme-specific imagery with the canonical Aura Noir root class", () => {
    const image = read("app/components/KlyxThemeImage.tsx");
    const themeProvider = read("app/components/ThemeProvider.tsx");

    expect(image).toContain('classList.contains("dark")');
    expect(image).toContain("MutationObserver");
    expect(image).toContain('data-klyx-image-theme={dark ? "noir" : "aura"}');
    expect(image).toContain("srcDark ?? srcLight");
    expect(image).toContain("fallbackDark ?? fallbackLight");
    expect(themeProvider).toContain(
      'document.documentElement.classList.toggle("dark", resolvedTheme === "dark")'
    );
  });

  it("routes globally visible profile and message avatars through KlyxImage", () => {
    const accountSwitcher = read("app/components/AccountSwitcher.tsx");
    const messages = read("app/messages/page.tsx");

    for (const source of [accountSwitcher, messages]) {
      expect(source).toContain("KlyxImage");
      expect(source).not.toContain("<img");
    }

    expect(accountSwitcher).toContain('sizes="36px"');
    expect(messages).toContain('sizes={`${size}px`}');
  });

  it("does not fake Noir compatibility with destructive image filters", () => {
    const image = read("app/components/KlyxThemeImage.tsx");

    expect(image).not.toContain("brightness-");
    expect(image).not.toContain("invert-");
    expect(image).not.toContain("grayscale-");
    expect(image).not.toContain("opacity-");
  });
});
