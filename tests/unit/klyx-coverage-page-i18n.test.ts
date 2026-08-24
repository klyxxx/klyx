import { describe, expect, it } from "vitest";
import {
  formatKlyxCoverageProviderCount,
  getKlyxCoverageDictionary,
  KLYX_COVERAGE_MESSAGE_KEYS,
  KLYX_COVERAGE_TRANSLATED_LOCALES,
  resolveKlyxCoverageLocale,
} from "@/lib/klyx-coverage-i18n";

describe("KLYX coverage i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_COVERAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxCoverageDictionary(locale);
      for (const key of KLYX_COVERAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
      expect(formatKlyxCoverageProviderCount(locale, 2)).toContain("2");
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxCoverageLocale("es")).toBe("fr");
    expect(getKlyxCoverageDictionary("es")).toEqual(
      getKlyxCoverageDictionary("fr")
    );
    expect(formatKlyxCoverageProviderCount("es", 1)).toBe(
      "1 prestataire dans le rayon"
    );
  });

  it("keeps singular and plural provider counts meaningful", () => {
    expect(formatKlyxCoverageProviderCount("en", 1)).toBe(
      "1 provider within range"
    );
    expect(formatKlyxCoverageProviderCount("en", 2)).toBe(
      "2 providers within range"
    );
  });
});
