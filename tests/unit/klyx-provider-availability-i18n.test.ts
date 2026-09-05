import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_AVAILABILITY_DAY_KEYS,
  KLYX_PROVIDER_AVAILABILITY_MESSAGE_KEYS,
  formatKlyxProviderAvailabilityActiveDays,
  formatKlyxProviderAvailabilityInvalidTime,
  resolveKlyxProviderAvailabilityLocale,
  translateKlyxProviderAvailability,
  translateKlyxProviderAvailabilityDay,
} from "@/lib/klyx-provider-availability-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;

describe("KLYX provider availability i18n", () => {
  it("has complete non-empty copy and weekday labels in every certified locale", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const key of KLYX_PROVIDER_AVAILABILITY_MESSAGE_KEYS) {
        expect(translateKlyxProviderAvailability(locale, key).trim()).not.toBe("");
      }

      for (const key of KLYX_PROVIDER_AVAILABILITY_DAY_KEYS) {
        expect(translateKlyxProviderAvailabilityDay(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("falls back deterministically to French outside availability certification", () => {
    expect(resolveKlyxProviderAvailabilityLocale("fr")).toBe("fr");
    expect(resolveKlyxProviderAvailabilityLocale("en")).toBe("en");
    expect(resolveKlyxProviderAvailabilityLocale("nl")).toBe("nl");
    expect(resolveKlyxProviderAvailabilityLocale("de")).toBe("de");
    expect(resolveKlyxProviderAvailabilityLocale("es")).toBe("fr");

    expect(translateKlyxProviderAvailability("es", "title")).toBe(
      translateKlyxProviderAvailability("fr", "title")
    );
    expect(translateKlyxProviderAvailabilityDay("es", "monday")).toBe(
      translateKlyxProviderAvailabilityDay("fr", "monday")
    );
  });

  it("formats active-day counts with locale-aware singular and plural copy", () => {
    expect(formatKlyxProviderAvailabilityActiveDays("fr", 0)).toBe(
      "0 jours actifs"
    );
    expect(formatKlyxProviderAvailabilityActiveDays("en", 1)).toBe(
      "1 active day"
    );
    expect(formatKlyxProviderAvailabilityActiveDays("nl", 2)).toBe(
      "2 actieve dagen"
    );
    expect(formatKlyxProviderAvailabilityActiveDays("de", 1)).toBe(
      "1 aktiver Tag"
    );
  });

  it("localizes validation copy without exposing backend details", () => {
    expect(formatKlyxProviderAvailabilityInvalidTime("fr", "Lundi")).toBe(
      "Lundi : l’heure de fin doit être après l’heure de début."
    );
    expect(formatKlyxProviderAvailabilityInvalidTime("en", "Monday")).toBe(
      "Monday: the end time must be after the start time."
    );
  });
});
