import { describe, expect, it } from "vitest";

import {
  formatKlyxEvaluatedMissionCount,
  formatKlyxPublicReviewCount,
  formatKlyxPublicReviewExperience,
  getKlyxPublicReviewsIntlLocale,
  translateKlyxPublicReviews,
} from "@/lib/klyx-public-reviews-i18n";
import type { KlyxLocale } from "@/lib/klyx-i18n";

const LOCALES = ["fr", "en", "nl", "de"] as const;
const KEYS = [
  "title",
  "summaryTitle",
  "identityVerified",
  "loadError",
  "emptyTitle",
  "verifiedBadge",
  "noComment",
] as const;

describe("KLYX public reviews i18n", () => {
  it("keeps core copy complete in every certified locale", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        expect(translateKlyxPublicReviews(locale, key).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    const locale = "es" as KlyxLocale;
    expect(translateKlyxPublicReviews(locale, "verifiedBadge")).toBe("Vérifié");
    expect(getKlyxPublicReviewsIntlLocale(locale)).toBe("fr-BE");
  });

  it("localizes counts and experience without changing numeric values", () => {
    expect(formatKlyxPublicReviewCount("en", 1)).toBe("1 verified review");
    expect(formatKlyxPublicReviewCount("en", 2)).toBe("2 verified reviews");
    expect(formatKlyxEvaluatedMissionCount("de", 2)).toBe("2 bewertete Aufträge");
    expect(formatKlyxPublicReviewExperience("fr", 1)).toBe("1 an");
    expect(formatKlyxPublicReviewExperience("en", 3)).toBe("3 years");
  });
});
