import { describe, expect, it } from "vitest";

import type { KlyxLocale } from "@/lib/klyx-i18n";
import {
  formatKlyxProviderProgress,
  getKlyxProviderProgressDictionary,
  KLYX_PROVIDER_PROGRESS_TRANSLATED_LOCALES,
  translateKlyxProviderProgress,
} from "@/lib/klyx-provider-progress-i18n";

describe("KLYX provider onboarding progress i18n", () => {
  it("certifies complete FR/EN/NL/DE dictionaries", () => {
    const referenceKeys = Object.keys(getKlyxProviderProgressDictionary("fr"));

    expect(KLYX_PROVIDER_PROGRESS_TRANSLATED_LOCALES).toEqual([
      "fr",
      "en",
      "nl",
      "de",
    ]);

    for (const locale of KLYX_PROVIDER_PROGRESS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderProgressDictionary(locale);
      expect(Object.keys(dictionary).sort()).toEqual([...referenceKeys].sort());
      expect(Object.values(dictionary).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(translateKlyxProviderProgress("es" as KlyxLocale, "journey")).toBe(
      translateKlyxProviderProgress("fr", "journey")
    );
  });

  it("formats progress counters without changing readiness inputs", () => {
    expect(
      formatKlyxProviderProgress("en", "requiredCompleted", {
        completed: 4,
        total: 7,
      })
    ).toBe("4/7 required steps completed");

    expect(formatKlyxProviderProgress("de", "step", { number: 3 })).toBe(
      "Schritt 3"
    );
  });
});
