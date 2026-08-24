import { describe, expect, it } from "vitest";

import type { ProviderSearchResponse } from "@/lib/provider-search";
import {
  getKlyxSearchRecoveryDictionary,
  KLYX_SEARCH_RECOVERY_MESSAGE_KEYS,
  KLYX_SEARCH_RECOVERY_TRANSLATED_LOCALES,
  resolveKlyxSearchRecoveryLocale,
} from "@/lib/klyx-search-recovery-i18n";
import {
  buildSearchRecoverySuggestions,
  recoveryHref,
  type SearchRecoveryFilters,
} from "@/lib/search-recovery";

describe("KLYX search recovery i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SEARCH_RECOVERY_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSearchRecoveryDictionary(locale);
      for (const key of KLYX_SEARCH_RECOVERY_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French outside the certified locales", () => {
    expect(resolveKlyxSearchRecoveryLocale("es")).toBe("fr");
    expect(getKlyxSearchRecoveryDictionary("es")).toEqual(
      getKlyxSearchRecoveryDictionary("fr")
    );
  });

  it("keeps recovery semantics identical when only the locale changes", () => {
    const filters: SearchRecoveryFilters = {
      service: "cleaning",
      city: "Brussels",
      date: "2026-08-30",
      startTime: "09:00",
      endTime: "11:00",
      budget: "10",
      pricing: "hourly",
      sort: "recommended",
    };
    const result = {
      providers: [{ price: 30, pricingType: "hourly" }],
    } as unknown as ProviderSearchResponse;

    const fr = buildSearchRecoverySuggestions(filters, result, "fr");
    const en = buildSearchRecoverySuggestions(filters, result, "en");

    const semantics = (
      suggestions: ReturnType<typeof buildSearchRecoverySuggestions>
    ) =>
      suggestions.map(({ id, priority, nextFilters }) => ({
        id,
        priority,
        nextFilters,
        href: recoveryHref(nextFilters),
      }));

    expect(semantics(en)).toEqual(semantics(fr));
    expect(en.map((item) => item.title)).not.toEqual(
      fr.map((item) => item.title)
    );
    expect(fr).toHaveLength(5);
    expect(fr[0]?.id).toBe("raise_budget");
    expect(fr[1]?.id).toBe("remove_time");
  });

  it("keeps the original two-argument builder compatible with French", () => {
    const filters: SearchRecoveryFilters = {
      service: "all",
      city: "",
      date: "",
      startTime: "",
      endTime: "",
      budget: "",
      pricing: "all",
      sort: "recommended",
    };
    const result = { providers: [] } as unknown as ProviderSearchResponse;

    expect(buildSearchRecoverySuggestions(filters, result)).toEqual(
      buildSearchRecoverySuggestions(filters, result, "fr")
    );
  });
});
