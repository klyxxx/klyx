import { describe, expect, it } from "vitest";
import {
  formatKlyxFounderEconomicsMoney,
  getKlyxFounderEconomicsDictionary,
  KLYX_FOUNDER_ECONOMICS_MESSAGE_KEYS,
  KLYX_FOUNDER_ECONOMICS_TRANSLATED_LOCALES,
  resolveKlyxFounderEconomicsLocale,
} from "@/lib/klyx-founder-economics-i18n";

describe("KLYX Founder economics i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_ECONOMICS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderEconomicsDictionary(locale);
      for (const key of KLYX_FOUNDER_ECONOMICS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
      expect(formatKlyxFounderEconomicsMoney(locale, 100).length).toBeGreaterThan(0);
    }
  });

  it("falls back explicitly to French and keeps EUR", () => {
    expect(resolveKlyxFounderEconomicsLocale("es")).toBe("fr");
    expect(getKlyxFounderEconomicsDictionary("es")).toEqual(
      getKlyxFounderEconomicsDictionary("fr")
    );
    expect(formatKlyxFounderEconomicsMoney("en", 100)).toContain("€");
  });
});
