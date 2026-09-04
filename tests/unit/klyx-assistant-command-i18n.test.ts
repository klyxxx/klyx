import { describe, expect, it } from "vitest";

import {
  KLYX_ASSISTANT_COMMAND_MESSAGE_KEYS,
  KLYX_ASSISTANT_COMMAND_TRANSLATED_LOCALES,
  getKlyxAssistantCommandDictionary,
  getKlyxAssistantCommandExamples,
  resolveKlyxAssistantCommandLocale,
  translateKlyxAssistantCommand,
} from "@/lib/klyx-assistant-command-i18n";
import {
  hasGeneralBrainCommandIntent,
  hasNewNeedBrainCommandIntent,
  hasSpecificBrainCommandIntent,
  normalizeBrainCommandMessage,
} from "@/lib/brain-command-intent";

describe("KLYX assistant command bar i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ASSISTANT_COMMAND_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAssistantCommandDictionary(locale);

      for (const key of KLYX_ASSISTANT_COMMAND_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }

      expect(getKlyxAssistantCommandExamples(locale)).toHaveLength(3);
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAssistantCommandLocale("es")).toBe("fr");
    expect(translateKlyxAssistantCommand("es", "continue")).toBe("Continuer");
    expect(getKlyxAssistantCommandExamples("es")).toEqual(
      getKlyxAssistantCommandExamples("fr")
    );
  });

  it("localizes dynamic publication copy without changing its data", () => {
    const params = { service: "plomberie", city: "Bruxelles" };

    expect(
      translateKlyxAssistantCommand("fr", "publishedRequestTitle", params)
    ).toBe("Besoin de plomberie");
    expect(
      translateKlyxAssistantCommand(
        "fr",
        "publishedRequestFallbackDescription",
        params
      )
    ).toBe("Demande KLYX pour plomberie à Bruxelles.");

    expect(
      translateKlyxAssistantCommand("en", "publishedRequestTitle", params)
    ).toBe("Need for plomberie");
    expect(
      translateKlyxAssistantCommand(
        "en",
        "publishedRequestFallbackDescription",
        params
      )
    ).toBe("KLYX request for plomberie in Bruxelles.");

    expect(
      translateKlyxAssistantCommand("nl", "publishedRequestTitle", params)
    ).toBe("Nood aan plomberie");
    expect(
      translateKlyxAssistantCommand(
        "nl",
        "publishedRequestFallbackDescription",
        params
      )
    ).toBe("KLYX-aanvraag voor plomberie in Bruxelles.");

    expect(
      translateKlyxAssistantCommand("de", "publishedRequestTitle", params)
    ).toBe("Bedarf an plomberie");
    expect(
      translateKlyxAssistantCommand(
        "de",
        "publishedRequestFallbackDescription",
        params
      )
    ).toBe("KLYX-Anfrage für plomberie in Bruxelles.");
  });

  it("keeps unsupported dynamic publication locales deterministic", () => {
    expect(
      translateKlyxAssistantCommand("es", "publishedRequestTitle", {
        service: "plomberie",
      })
    ).toBe("Besoin de plomberie");
  });

  it("keeps all localized examples compatible with the deterministic router", () => {
    for (const locale of KLYX_ASSISTANT_COMMAND_TRANSLATED_LOCALES) {
      const [newNeed, general, existing] = getKlyxAssistantCommandExamples(locale);

      expect(hasNewNeedBrainCommandIntent(normalizeBrainCommandMessage(newNeed!))).toBe(true);
      expect(hasGeneralBrainCommandIntent(normalizeBrainCommandMessage(general!))).toBe(true);
      expect(hasSpecificBrainCommandIntent(normalizeBrainCommandMessage(existing!))).toBe(true);
    }
  });

  it("keeps safe generic errors local to presentation", () => {
    expect(translateKlyxAssistantCommand("fr", "genericError")).not.toContain("Error");
    expect(translateKlyxAssistantCommand("en", "genericError")).toContain("cannot process");
  });
});
