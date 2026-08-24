import { describe, expect, it } from "vitest";
import {
  formatKlyxFounderTestDateTime,
  getKlyxFounderTestDictionary,
  KLYX_FOUNDER_TEST_MESSAGE_KEYS,
  KLYX_FOUNDER_TEST_TRANSLATED_LOCALES,
  resolveKlyxFounderTestLocale,
  translateKlyxFounderTestGroup,
} from "@/lib/klyx-founder-test-i18n";

describe("KLYX Founder Test i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_TEST_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderTestDictionary(locale);
      for (const key of KLYX_FOUNDER_TEST_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFounderTestLocale("es")).toBe("fr");
    expect(getKlyxFounderTestDictionary("es")).toEqual(
      getKlyxFounderTestDictionary("fr")
    );
  });

  it("localizes known groups while preserving future group names", () => {
    for (const locale of KLYX_FOUNDER_TEST_TRANSLATED_LOCALES) {
      expect(translateKlyxFounderTestGroup(locale, "Sécurité").trim().length).toBeGreaterThan(0);
      expect(translateKlyxFounderTestGroup(locale, "Beta 12.6").trim().length).toBeGreaterThan(0);
      expect(translateKlyxFounderTestGroup(locale, "Future diagnostics")).toBe("Future diagnostics");
      expect(formatKlyxFounderTestDateTime(locale, "2026-08-24T17:00:00Z").length).toBeGreaterThan(0);
    }
  });
});
