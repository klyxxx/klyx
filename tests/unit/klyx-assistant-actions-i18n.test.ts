import { describe, expect, it } from "vitest";

import {
  KLYX_ASSISTANT_ACTIONS_MESSAGE_KEYS,
  KLYX_ASSISTANT_ACTIONS_TRANSLATED_LOCALES,
  formatKlyxAssistantActionCount,
  getKlyxAssistantActionsDictionary,
  resolveKlyxAssistantActionsLocale,
  translateKlyxAssistantActions,
} from "@/lib/klyx-assistant-actions-i18n";

describe("KLYX assistant actions page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ASSISTANT_ACTIONS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAssistantActionsDictionary(locale);

      for (const key of KLYX_ASSISTANT_ACTIONS_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAssistantActionsLocale("es")).toBe("fr");
    expect(translateKlyxAssistantActions("es", "refresh")).toBe("Actualiser");
  });

  it("formats action counts without malformed plurals", () => {
    expect(formatKlyxAssistantActionCount("fr", 1)).toBe("1 action");
    expect(formatKlyxAssistantActionCount("fr", 2)).toBe("2 actions");
    expect(formatKlyxAssistantActionCount("en", 2)).toBe("2 actions");
    expect(formatKlyxAssistantActionCount("nl", 2)).toBe("2 acties");
    expect(formatKlyxAssistantActionCount("de", 2)).toBe("2 Aktionen");
  });

  it("keeps the static financial copy as guidance rather than execution", () => {
    expect(translateKlyxAssistantActions("en", "description")).toContain("payment");
    expect(translateKlyxAssistantActions("nl", "description")).toContain("betaling");
  });
});
