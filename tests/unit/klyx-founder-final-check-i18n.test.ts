import { describe, expect, it } from "vitest";
import {
  formatKlyxFounderFinalCheckPageDescription,
  formatKlyxFounderFinalCheckPending,
  formatKlyxFounderFinalCheckProfileCount,
  formatKlyxFounderFinalCheckUnreferenced,
  getKlyxFounderFinalCheckDictionary,
  KLYX_FOUNDER_FINAL_CHECK_MESSAGE_KEYS,
  KLYX_FOUNDER_FINAL_CHECK_TRANSLATED_LOCALES,
  resolveKlyxFounderFinalCheckLocale,
  translateKlyxFounderFinalCheckPageLabel,
} from "@/lib/klyx-founder-final-check-i18n";

describe("KLYX Founder final-check i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_FINAL_CHECK_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderFinalCheckDictionary(locale);
      for (const key of KLYX_FOUNDER_FINAL_CHECK_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFounderFinalCheckLocale("es")).toBe("fr");
    expect(getKlyxFounderFinalCheckDictionary("es")).toEqual(
      getKlyxFounderFinalCheckDictionary("fr")
    );
  });

  it("localizes known probe labels and safely preserves unknown paths", () => {
    for (const locale of KLYX_FOUNDER_FINAL_CHECK_TRANSLATED_LOCALES) {
      expect(translateKlyxFounderFinalCheckPageLabel(locale, "/dashboard").length).toBeGreaterThan(0);
      expect(formatKlyxFounderFinalCheckPageDescription(locale, "/dashboard")).toContain("/dashboard");
      expect(formatKlyxFounderFinalCheckProfileCount(locale, 2, "client")).toContain("2");
      expect(formatKlyxFounderFinalCheckUnreferenced(locale, 3)).toContain("3");
      expect(formatKlyxFounderFinalCheckPending(locale, 503)).toContain("HTTP 503");
    }
    expect(translateKlyxFounderFinalCheckPageLabel("en", "/future")).toBe("/future");
  });
});
