import { describe, expect, it } from "vitest";

import {
  KLYX_ASSISTANT_BRIEF_MESSAGE_KEYS,
  KLYX_ASSISTANT_BRIEF_TRANSLATED_LOCALES,
  formatKlyxAssistantBriefText,
  formatKlyxAssistantBriefUrgentCount,
  getKlyxAssistantBriefDictionary,
  resolveKlyxAssistantBriefLocale,
  translateKlyxAssistantBrief,
} from "@/lib/klyx-assistant-brief-i18n";

describe("KLYX assistant brief i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ASSISTANT_BRIEF_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAssistantBriefDictionary(locale);

      for (const key of KLYX_ASSISTANT_BRIEF_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAssistantBriefLocale("es")).toBe("fr");
    expect(translateKlyxAssistantBrief("es", "upToDate")).toBe("À jour");
  });

  it("keeps server action titles verbatim inside localized sentences", () => {
    const title = "Paiement groupé à finaliser";
    expect(formatKlyxAssistantBriefText("en", "client", title, 2)).toContain(title);
    expect(formatKlyxAssistantBriefText("nl", "client", title, 1)).toContain(title);
    expect(formatKlyxAssistantBriefText("de", "provider", title, 0)).toContain(title);
  });

  it("formats urgent counts safely", () => {
    expect(formatKlyxAssistantBriefUrgentCount("fr", 2)).toBe("2 urgentes");
    expect(formatKlyxAssistantBriefUrgentCount("en", 2)).toBe("2 urgent");
    expect(formatKlyxAssistantBriefUrgentCount("nl", 2)).toBe("2 dringend");
    expect(formatKlyxAssistantBriefUrgentCount("de", 2)).toBe("2 dringend");
  });

  it("distinguishes client and provider empty states", () => {
    expect(formatKlyxAssistantBriefText("fr", "client", null, 0)).toContain("Tout est à jour");
    expect(formatKlyxAssistantBriefText("fr", "provider", null, 0)).toContain("Ton activité est à jour");
  });
});
