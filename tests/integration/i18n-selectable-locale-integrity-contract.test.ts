import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { KLYX_COVERAGE_TRANSLATED_LOCALES } from "../../lib/klyx-coverage-i18n";
import {
  KLYX_FULLY_TRANSLATED_LOCALES,
  KLYX_LANGUAGE_OPTIONS,
  KLYX_REGISTERED_LANGUAGE_OPTIONS,
  normalizeKlyxLocale,
  normalizeKlyxSelectableLocale,
  resolveKlyxSelectableLocale,
} from "../../lib/klyx-i18n";
import { KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES } from "../../lib/klyx-messages-page-i18n";
import { KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES } from "../../lib/klyx-page-i18n";
import { KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES } from "../../lib/klyx-settings-page-i18n";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX selectable locale integrity", () => {
  it("keeps the 64 registered locale packs while exposing only complete UI locales", () => {
    expect(KLYX_REGISTERED_LANGUAGE_OPTIONS).toHaveLength(64);
    expect(KLYX_LANGUAGE_OPTIONS.map((option) => option.value)).toEqual(
      KLYX_FULLY_TRANSLATED_LOCALES
    );
  });

  it("requires every selectable locale to exist in critical page dictionaries", () => {
    const criticalCoverage = [
      KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES,
      KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES,
      KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES,
      KLYX_COVERAGE_TRANSLATED_LOCALES,
    ];

    for (const locale of KLYX_FULLY_TRANSLATED_LOCALES) {
      for (const translatedLocales of criticalCoverage) {
        expect(translatedLocales).toContain(locale);
      }
    }
  });

  it("keeps registered normalization for future batches but clamps the app UI", () => {
    expect(normalizeKlyxLocale("es-ES")).toBe("es");
    expect(normalizeKlyxLocale("ar-MA")).toBe("ar");
    expect(normalizeKlyxSelectableLocale("nl-BE")).toBe("nl");
    expect(normalizeKlyxSelectableLocale("de-DE")).toBe("de");
    expect(normalizeKlyxSelectableLocale("es-ES")).toBe("fr");
    expect(normalizeKlyxSelectableLocale("ar-MA")).toBe("fr");
  });

  it("chooses the first complete browser locale instead of a registered incomplete one", () => {
    expect(resolveKlyxSelectableLocale(["es-ES", "nl-BE", "en-US"]))
      .toBe("nl");
    expect(resolveKlyxSelectableLocale(["ar-MA", "de-DE"]))
      .toBe("de");
    expect(resolveKlyxSelectableLocale(["es-ES", "ar-MA"]))
      .toBe("fr");
  });

  it("uses the selectable locale guard in SSR, saved preferences and Settings", () => {
    const provider = read("app/components/KlyxLocaleProvider.tsx");
    const server = read("lib/klyx-server-i18n.ts");
    const settings = read("app/settings/page.tsx");

    expect(provider).toContain("normalizeKlyxSelectableLocale");
    expect(provider).not.toContain("normalizeKlyxLocale");
    expect(server).toContain("normalizeKlyxSelectableLocale");
    expect(server).toContain("resolveKlyxSelectableLocale");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS");
    expect(settings).toContain("options={KLYX_LANGUAGE_OPTIONS.map");
  });
});
