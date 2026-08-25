import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_JOBS_MESSAGE_KEYS,
  KLYX_PROVIDER_JOBS_TRANSLATED_LOCALES,
  formatKlyxProviderJobsCount,
  formatKlyxProviderJobsDuration,
  formatKlyxProviderJobsMoney,
  getKlyxProviderJobsDictionary,
  getKlyxProviderJobsIntlLocale,
  resolveKlyxProviderJobsLocale,
  translateKlyxProviderJobOfferStatus,
  translateKlyxProviderJobs,
  translateKlyxProviderJobsMatch,
} from "@/lib/klyx-provider-jobs-i18n";

describe("KLYX provider jobs i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROVIDER_JOBS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderJobsDictionary(locale);
      for (const key of KLYX_PROVIDER_JOBS_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
      expect(getKlyxProviderJobsIntlLocale(locale)).toMatch(/-BE$/);
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProviderJobsLocale("es")).toBe("fr");
    expect(translateKlyxProviderJobs("es", "sendOffer")).toBe(
      "Envoyer l’offre"
    );
    expect(getKlyxProviderJobsIntlLocale("es")).toBe("fr-BE");
  });

  it("localizes known offer statuses and preserves unknown statuses", () => {
    expect(translateKlyxProviderJobOfferStatus("en", "sent")).toBe("Pending");
    expect(translateKlyxProviderJobOfferStatus("nl", "accepted")).toBe(
      "Geaccepteerd"
    );
    expect(translateKlyxProviderJobOfferStatus("de", "rejected")).toBe(
      "Abgelehnt"
    );
    expect(translateKlyxProviderJobOfferStatus("en", "future_status")).toBe(
      "future_status"
    );
  });

  it("keeps match-score bands stable across locales", () => {
    expect(translateKlyxProviderJobsMatch("fr", 90)).toBe("Excellent match");
    expect(translateKlyxProviderJobsMatch("en", 80)).toBe("Very good match");
    expect(translateKlyxProviderJobsMatch("nl", 70)).toBe("Goede match");
    expect(translateKlyxProviderJobsMatch("de", 60)).toBe("Kompatibel");
    expect(translateKlyxProviderJobsMatch("de", 59)).toBe("Prüfen");
  });

  it("localizes money fallbacks and keeps valid currencies", () => {
    expect(formatKlyxProviderJobsMoney("fr", null, "EUR")).toBe("Non précisé");
    expect(formatKlyxProviderJobsMoney("en", null, "EUR")).toBe("Not specified");
    expect(formatKlyxProviderJobsMoney("en", 12.5, "EUR")).toContain("12");
    expect(formatKlyxProviderJobsMoney("fr", 12.5, "EU")).toBe("12.50");
  });

  it("keeps duration and count formatting deterministic", () => {
    expect(formatKlyxProviderJobsDuration("fr", 135)).toBe("2 h 15 min");
    expect(formatKlyxProviderJobsDuration("en", null)).toBe("Duration to confirm");
    expect(formatKlyxProviderJobsCount("fr", 2, "slot")).toBe("2 créneaux");
    expect(formatKlyxProviderJobsCount("en", 1, "offer")).toBe("1 offer sent");
    expect(formatKlyxProviderJobsCount("de", 2, "mission")).toBe(
      "2 Aufträge verfügbar"
    );
  });
});
