import { describe, expect, it } from "vitest";

import {
  KLYX_ASSISTANT_HOME_MESSAGE_KEYS,
  KLYX_ASSISTANT_HOME_TRANSLATED_LOCALES,
  formatKlyxAssistantHomeActionCount,
  getKlyxAssistantHomeDictionary,
  resolveKlyxAssistantHomeLocale,
  translateKlyxAssistantHome,
} from "@/lib/klyx-assistant-home-i18n";

describe("KLYX assistant home i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ASSISTANT_HOME_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAssistantHomeDictionary(locale);

      for (const key of KLYX_ASSISTANT_HOME_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("localizes the canonical assistant heading and notification label", () => {
    expect(translateKlyxAssistantHome("fr", "organizeTitle")).toBe(
      "Que dois-je organiser pour vous ?"
    );
    expect(translateKlyxAssistantHome("en", "organizeTitle")).toBe(
      "What should I organize for you?"
    );
    expect(translateKlyxAssistantHome("nl", "organizeTitle")).toBe(
      "Wat zal ik voor je organiseren?"
    );
    expect(translateKlyxAssistantHome("de", "organizeTitle")).toBe(
      "Was soll ich für dich organisieren?"
    );
    expect(translateKlyxAssistantHome("nl", "notifications")).toBe("Meldingen");
    expect(translateKlyxAssistantHome("de", "notifications")).toBe(
      "Benachrichtigungen"
    );
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAssistantHomeLocale("es")).toBe("fr");
    expect(translateKlyxAssistantHome("es", "open")).toBe("Ouvrir");
    expect(translateKlyxAssistantHome("es", "organizeTitle")).toBe(
      "Que dois-je organiser pour vous ?"
    );
  });

  it("formats client action counts per locale", () => {
    expect(formatKlyxAssistantHomeActionCount("fr", 2, "client")).toBe(
      "2 actions détectées par KLYX."
    );
    expect(formatKlyxAssistantHomeActionCount("en", 1, "client")).toBe(
      "1 action detected by KLYX."
    );
    expect(formatKlyxAssistantHomeActionCount("nl", 2, "client")).toContain(
      "2 acties"
    );
    expect(formatKlyxAssistantHomeActionCount("de", 1, "client")).toContain(
      "1 von KLYX erkannte Aktion"
    );
  });

  it("keeps provider action counts distinct", () => {
    expect(formatKlyxAssistantHomeActionCount("fr", 1, "provider")).toBe(
      "1 action prioritaire pour ton activité."
    );
    expect(formatKlyxAssistantHomeActionCount("en", 2, "provider")).toBe(
      "2 priority actions for your activity."
    );
  });
});
