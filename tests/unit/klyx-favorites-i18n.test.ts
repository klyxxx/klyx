import { describe, expect, it } from "vitest";
import {
  formatKlyxFavoritePrice,
  getKlyxFavoritesDictionary,
  KLYX_FAVORITES_MESSAGE_KEYS,
  KLYX_FAVORITES_TRANSLATED_LOCALES,
  resolveKlyxFavoritesLocale,
} from "@/lib/klyx-favorites-i18n";

describe("KLYX favorites i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FAVORITES_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFavoritesDictionary(locale);
      for (const key of KLYX_FAVORITES_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFavoritesLocale("es")).toBe("fr");
    expect(getKlyxFavoritesDictionary("es")).toEqual(
      getKlyxFavoritesDictionary("fr")
    );
  });

  it("formats the existing EUR price without conversion", () => {
    for (const locale of KLYX_FAVORITES_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFavoritesDictionary(locale);
      const hourly = formatKlyxFavoritePrice(locale, 12.5, "hourly");
      const fixed = formatKlyxFavoritePrice(locale, 12.5, "fixed");

      expect(hourly).toContain("€");
      expect(hourly).toContain(dictionary.hourSuffix);
      expect(fixed).toContain("€");
      expect(fixed).toContain(dictionary.fixedRateSuffix);
      expect(formatKlyxFavoritePrice(locale, null, "hourly")).toBe(
        dictionary.priceToConfirm
      );
    }
  });
});
