import { describe, expect, it } from "vitest";
import {
  formatKlyxPublicProviderAvailability,
  formatKlyxPublicProviderCompletedJobs,
  formatKlyxPublicProviderExperience,
  formatKlyxPublicProviderPrice,
  formatKlyxPublicProviderScoreLabel,
  formatKlyxPublicProviderServiceLabel,
  getKlyxPublicProviderDictionary,
  KLYX_PUBLIC_PROVIDER_MESSAGE_KEYS,
  KLYX_PUBLIC_PROVIDER_TRANSLATED_LOCALES,
  resolveKlyxPublicProviderLocale,
} from "@/lib/klyx-public-provider-i18n";

describe("KLYX public provider i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PUBLIC_PROVIDER_TRANSLATED_LOCALES) {
      const dictionary = getKlyxPublicProviderDictionary(locale);
      for (const key of KLYX_PUBLIC_PROVIDER_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxPublicProviderLocale("es")).toBe("fr");
    expect(getKlyxPublicProviderDictionary("es")).toEqual(
      getKlyxPublicProviderDictionary("fr")
    );
  });

  it("localizes known built-in services while preserving custom fallback", () => {
    expect(formatKlyxPublicProviderServiceLabel("en", "cleaning", "Ménage")).toBe(
      "Cleaning"
    );
    expect(
      formatKlyxPublicProviderServiceLabel("de", "custom-service", "Piano tuning")
    ).toBe("Piano tuning");
  });

  it("keeps numeric business values intact while localizing presentation", () => {
    expect(formatKlyxPublicProviderPrice("fr", 25, "fixed")).toBe("25.00 € forfait");
    expect(formatKlyxPublicProviderPrice("en", 25, "hourly")).toBe("25.00 €/h");
    expect(formatKlyxPublicProviderExperience("en", 2)).toContain("2");
    expect(formatKlyxPublicProviderAvailability("nl", 3)).toContain("3");
    expect(formatKlyxPublicProviderCompletedJobs("de", 4)).toContain("4");
    expect(formatKlyxPublicProviderScoreLabel("en", 92)).toBe("Excellent");
  });
});
