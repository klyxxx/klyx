import { describe, expect, it } from "vitest";

import {
  explainProviderMatch,
  matchingLevelLabel,
  type MatchingFilters,
} from "@/lib/intelligent-matching";
import {
  formatKlyxCoverageMessage,
  getKlyxMatchExplanationDictionary,
  KLYX_MATCH_EXPLANATION_MESSAGE_KEYS,
  KLYX_MATCH_EXPLANATION_TRANSLATED_LOCALES,
  resolveKlyxMatchExplanationLocale,
} from "@/lib/klyx-match-explanation-i18n";
import type { ProviderSearchItem } from "@/lib/provider-search";

describe("KLYX match explanation i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_MATCH_EXPLANATION_TRANSLATED_LOCALES) {
      const dictionary = getKlyxMatchExplanationDictionary(locale);
      for (const key of KLYX_MATCH_EXPLANATION_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French outside the certified locales", () => {
    expect(resolveKlyxMatchExplanationLocale("es")).toBe("fr");
    expect(getKlyxMatchExplanationDictionary("es")).toEqual(
      getKlyxMatchExplanationDictionary("fr")
    );
  });

  it("keeps matching mathematics identical when only the locale changes", () => {
    const provider = {
      city: "Brussels",
      serviceArea: ["Brussels"],
      isExactMatch: true,
      price: 20,
      pricingType: "hourly",
      klyxScore: 90,
      isVerified: true,
      completedJobs: 12,
      yearsExperience: 6,
      cancellationRate: 0.05,
    } as unknown as ProviderSearchItem;
    const filters: MatchingFilters = {
      city: "Brussels",
      date: "2026-08-30",
      startTime: "09:00",
      endTime: "10:00",
      budget: "30",
      pricing: "hourly",
    };

    const fr = explainProviderMatch(provider, filters, "fr");
    const en = explainProviderMatch(provider, filters, "en");

    expect(en.score).toBe(fr.score);
    expect(en.level).toBe(fr.level);
    expect(en.reasons).toHaveLength(fr.reasons.length);
    expect(en.warnings).toHaveLength(fr.warnings.length);
    expect(en.reasons).not.toEqual(fr.reasons);
  });

  it("keeps the original two-argument matching API French by default", () => {
    const provider = {
      city: "",
      serviceArea: [],
      isExactMatch: false,
      price: null,
      pricingType: "hourly",
      klyxScore: 0,
      isVerified: false,
      completedJobs: 0,
      yearsExperience: 0,
      cancellationRate: 0.2,
    } as unknown as ProviderSearchItem;
    const filters: MatchingFilters = {
      city: "",
      date: "",
      startTime: "",
      endTime: "",
      budget: "",
      pricing: "all",
    };

    expect(explainProviderMatch(provider, filters)).toEqual(
      explainProviderMatch(provider, filters, "fr")
    );
    expect(matchingLevelLabel("excellent")).toBe(
      matchingLevelLabel("excellent", "fr")
    );
  });

  it("localizes structured coverage without relying on the API message", () => {
    const input = {
      covered: true,
      requestedLocality: "Brussels",
      zoneLocality: "Brussels",
      distanceKm: 0,
      radiusKm: 20,
    };

    expect(formatKlyxCoverageMessage("fr", input)).toContain("Brussels");
    expect(formatKlyxCoverageMessage("en", input)).toContain("Brussels");
    expect(formatKlyxCoverageMessage("en", input)).not.toBe(
      formatKlyxCoverageMessage("fr", input)
    );
  });
});
