import { describe, expect, it } from "vitest";
import {
  formatKlyxFounderAnalyticsDate,
  formatKlyxFounderAnalyticsNumber,
  formatKlyxFounderAnalyticsPercent,
  getKlyxFounderAnalyticsDictionary,
  KLYX_FOUNDER_ANALYTICS_MESSAGE_KEYS,
  KLYX_FOUNDER_ANALYTICS_TRANSLATED_LOCALES,
  resolveKlyxFounderAnalyticsLocale,
} from "@/lib/klyx-founder-analytics-i18n";
import {
  formatKlyxFounderAnalyticsAccepted,
  formatKlyxFounderAnalyticsCompleted,
  formatKlyxFounderAnalyticsDailyTooltip,
  formatKlyxFounderAnalyticsWithResults,
} from "@/lib/klyx-founder-analytics-format";

describe("KLYX founder analytics i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_ANALYTICS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderAnalyticsDictionary(locale);
      for (const key of KLYX_FOUNDER_ANALYTICS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFounderAnalyticsLocale("es")).toBe("fr");
    expect(getKlyxFounderAnalyticsDictionary("es")).toEqual(
      getKlyxFounderAnalyticsDictionary("fr")
    );
    expect(formatKlyxFounderAnalyticsDate("es", "2026-08-24")).toBe(
      formatKlyxFounderAnalyticsDate("fr", "2026-08-24")
    );
  });

  it("formats aggregate metrics without changing values", () => {
    for (const locale of KLYX_FOUNDER_ANALYTICS_TRANSLATED_LOCALES) {
      expect(formatKlyxFounderAnalyticsNumber(locale, 1234).length).toBeGreaterThan(0);
      expect(formatKlyxFounderAnalyticsPercent(locale, 62.5)).toContain("62");
      expect(formatKlyxFounderAnalyticsPercent(locale, null)).toBe("—");
      expect(formatKlyxFounderAnalyticsWithResults(locale, 12)).toContain("12");
      expect(formatKlyxFounderAnalyticsAccepted(locale, 7)).toContain("7");
      expect(formatKlyxFounderAnalyticsCompleted(locale, 3)).toContain("3");
      const tooltip = formatKlyxFounderAnalyticsDailyTooltip(locale, "2026-08-24", 9, 55);
      expect(tooltip).toContain("9");
      expect(tooltip).toContain("55%");
    }
  });
});
