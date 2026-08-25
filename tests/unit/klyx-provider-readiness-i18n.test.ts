import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_READINESS_MESSAGE_KEYS,
  KLYX_PROVIDER_READINESS_TRANSLATED_LOCALES,
  formatKlyxProviderReadinessCompleted,
  getKlyxProviderReadinessDictionary,
  resolveKlyxProviderReadinessLocale,
  translateKlyxProviderReadiness,
} from "@/lib/klyx-provider-readiness-i18n";

describe("KLYX provider readiness i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROVIDER_READINESS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderReadinessDictionary(locale);

      for (const key of KLYX_PROVIDER_READINESS_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProviderReadinessLocale("es")).toBe("fr");
    expect(translateKlyxProviderReadiness("es", "refresh")).toBe("Actualiser");
    expect(formatKlyxProviderReadinessCompleted("es", 3)).toBe(
      "3/4 éléments complétés"
    );
  });

  it("formats the readiness count for every certified locale", () => {
    expect(formatKlyxProviderReadinessCompleted("fr", 2)).toBe(
      "2/4 éléments complétés"
    );
    expect(formatKlyxProviderReadinessCompleted("en", 2)).toBe(
      "2/4 items completed"
    );
    expect(formatKlyxProviderReadinessCompleted("nl", 2)).toBe(
      "2/4 onderdelen voltooid"
    );
    expect(formatKlyxProviderReadinessCompleted("de", 2)).toBe(
      "2/4 Punkte abgeschlossen"
    );
  });

  it("keeps provider-readiness errors presentation-safe", () => {
    expect(translateKlyxProviderReadiness("fr", "genericError")).not.toContain(
      "Error"
    );
    expect(translateKlyxProviderReadiness("en", "genericError")).toContain(
      "cannot check"
    );
  });
});
