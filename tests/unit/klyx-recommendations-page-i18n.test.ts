import { describe, expect, it } from "vitest";

import {
  formatKlyxRecommendationExperience,
  formatKlyxRecommendationMissions,
  formatKlyxRecommendationPrice,
  formatKlyxRecommendationScore,
  formatKlyxRecommendationService,
  translateKlyxRecommendations,
} from "@/lib/klyx-recommendations-page-i18n";
import type { KlyxLocale } from "@/lib/klyx-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;

const KEYS = [
  "editRequest",
  "title",
  "loadError",
  "noProviderTitle",
  "recommendations",
  "bestChoice",
  "viewProfile",
  "choose",
] as const;

describe("KLYX recommendations page i18n", () => {
  it("keeps the certified locale dictionaries complete for core chrome", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const key of KEYS) {
        expect(translateKlyxRecommendations(locale, key).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French outside certified page locales", () => {
    const locale = "es" as KlyxLocale;
    expect(translateKlyxRecommendations(locale, "choose")).toBe("Choisir");
    expect(formatKlyxRecommendationScore(locale, 95)).toBe("Excellent");
  });

  it("localizes presentation formatters without changing semantic values", () => {
    expect(formatKlyxRecommendationPrice("en", 25, "hourly")).toContain("25.00");
    expect(formatKlyxRecommendationPrice("de", null, "fixed")).toBe("Preis zu bestätigen");
    expect(formatKlyxRecommendationExperience("en", 2)).toBe("2 years of experience");
    expect(formatKlyxRecommendationMissions("nl", 3)).toBe("3 opdrachten");
    expect(formatKlyxRecommendationScore("en", 80)).toBe("Very reliable");
  });

  it("localizes only known built-in services and preserves custom fallbacks", () => {
    expect(formatKlyxRecommendationService("en", "cleaning", "Ménage")).toBe("Cleaning");
    expect(formatKlyxRecommendationService("de", "moving", "Déménagement")).toBe("Umzug");
    expect(formatKlyxRecommendationService("nl", "custom-service", "Custom Service")).toBe("Custom Service");
  });
});
