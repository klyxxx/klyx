import { describe, expect, it } from "vitest";
import {
  getKlyxFounderCleanupDictionary,
  KLYX_FOUNDER_CLEANUP_MESSAGE_KEYS,
  KLYX_FOUNDER_CLEANUP_TRANSLATED_LOCALES,
  resolveKlyxFounderCleanupLocale,
} from "@/lib/klyx-founder-cleanup-i18n";

describe("KLYX Founder cleanup i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_CLEANUP_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderCleanupDictionary(locale);
      for (const key of KLYX_FOUNDER_CLEANUP_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFounderCleanupLocale("es")).toBe("fr");
    expect(getKlyxFounderCleanupDictionary("es")).toEqual(
      getKlyxFounderCleanupDictionary("fr")
    );
  });
});
