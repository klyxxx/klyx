import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_ASSISTANT_MESSAGE_KEYS,
  KLYX_PROVIDER_ASSISTANT_TRANSLATED_LOCALES,
  getKlyxProviderAssistantDictionary,
  getKlyxProviderAssistantExamples,
  getKlyxProviderAssistantIntlLocale,
  resolveKlyxProviderAssistantLocale,
  translateKlyxProviderAssistant,
  translateKlyxProviderAssistantStatus,
} from "@/lib/klyx-provider-assistant-i18n";

describe("KLYX provider assistant i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROVIDER_ASSISTANT_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderAssistantDictionary(locale);

      for (const key of KLYX_PROVIDER_ASSISTANT_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }

      expect(getKlyxProviderAssistantExamples(locale)).toHaveLength(4);
      expect(getKlyxProviderAssistantIntlLocale(locale)).toMatch(/-BE$/);
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProviderAssistantLocale("es")).toBe("fr");
    expect(translateKlyxProviderAssistant("es", "prepare")).toBe(
      "Préparer"
    );
    expect(getKlyxProviderAssistantExamples("es")[0]).toBe(
      "Je suis libre jeudi de 9 h à 14 h."
    );
    expect(getKlyxProviderAssistantIntlLocale("es")).toBe("fr-BE");
  });

  it("localizes known draft statuses and preserves unknown statuses", () => {
    expect(translateKlyxProviderAssistantStatus("en", "draft")).toBe(
      "Draft"
    );
    expect(translateKlyxProviderAssistantStatus("nl", "applied")).toBe(
      "Toegepast"
    );
    expect(translateKlyxProviderAssistantStatus("de", "discarded")).toBe(
      "Verworfen"
    );
    expect(
      translateKlyxProviderAssistantStatus("en", "future_status")
    ).toBe("future_status");
  });

  it("keeps localized examples aligned with the supported provider intents", () => {
    for (const locale of KLYX_PROVIDER_ASSISTANT_TRANSLATED_LOCALES) {
      const [availability, quote, reply] =
        getKlyxProviderAssistantExamples(locale);

      expect(availability.trim().length).toBeGreaterThan(10);
      expect(quote.trim().length).toBeGreaterThan(10);
      expect(reply.trim().length).toBeGreaterThan(10);
    }
  });
});
