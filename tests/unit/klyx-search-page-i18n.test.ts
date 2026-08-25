import { describe, expect, it } from "vitest";
import {
  formatKlyxSearchBudget,
  formatKlyxSearchComparedProfiles,
  formatKlyxSearchExperience,
  formatKlyxSearchJobs,
  formatKlyxSearchPricingOption,
  formatKlyxSearchProviderPrice,
  formatKlyxSearchResultSummary,
  formatKlyxSearchReviewCount,
  formatKlyxSearchScoreLabel,
  formatKlyxSearchServiceLabel,
  formatKlyxSearchSortOption,
  formatKlyxSearchWhen,
  getKlyxSearchPageDictionary,
  KLYX_SEARCH_PAGE_MESSAGE_KEYS,
  KLYX_SEARCH_PAGE_TRANSLATED_LOCALES,
  resolveKlyxSearchPageLocale,
} from "@/lib/klyx-search-page-i18n";

describe("KLYX search page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SEARCH_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSearchPageDictionary(locale);

      for (const key of KLYX_SEARCH_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxSearchPageLocale("es")).toBe("fr");
    expect(getKlyxSearchPageDictionary("es")).toEqual(
      getKlyxSearchPageDictionary("fr")
    );
  });

  it("localizes known controlled options without changing custom service labels", () => {
    expect(formatKlyxSearchServiceLabel("en", "cleaning", "Ménage")).toBe(
      "Cleaning"
    );
    expect(
      formatKlyxSearchServiceLabel("de", "piano-tuning", "Piano tuning")
    ).toBe("Piano tuning");
    expect(formatKlyxSearchPricingOption("nl", "hourly", "Tarif horaire")).toBe(
      "Uurtarief"
    );
    expect(formatKlyxSearchSortOption("de", "rating_desc", "Mieux notés")).toBe(
      "Am besten bewertet"
    );
  });

  it("keeps numeric business values while localizing presentation", () => {
    expect(formatKlyxSearchBudget("en", "80")).toBe("80.00 € maximum");
    expect(formatKlyxSearchProviderPrice("fr", 25, "fixed")).toBe(
      "25.00 € forfait"
    );
    expect(formatKlyxSearchScoreLabel("nl", 92)).toBe("Uitstekend");
    expect(formatKlyxSearchReviewCount("en", 2)).toBe("2 verified reviews");
    expect(formatKlyxSearchExperience("de", 2)).toBe("2 Jahre");
    expect(formatKlyxSearchJobs("de", 2)).toBe("2 Aufträge");
    expect(formatKlyxSearchComparedProfiles("nl", 2)).toBe(
      "2 profielen vergeleken"
    );
  });

  it("formats search summaries without malformed plurals", () => {
    expect(formatKlyxSearchResultSummary("nl", 2, 5)).toBe(
      "2 resultaten van 5 gepubliceerde diensten"
    );
    expect(formatKlyxSearchResultSummary("de", 2, 5)).toBe(
      "2 Ergebnisse von 5 veröffentlichten Dienstleistungen"
    );
    expect(formatKlyxSearchWhen("nl", "2026-08-25", "09:00", "11:00")).toContain(
      "van 09:00 tot 11:00"
    );
  });
});
