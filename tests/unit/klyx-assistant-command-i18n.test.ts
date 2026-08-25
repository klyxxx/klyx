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
