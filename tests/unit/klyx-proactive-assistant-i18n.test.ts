import { describe, expect, it } from "vitest";

import {
  KLYX_PROACTIVE_ASSISTANT_MESSAGE_KEYS,
  KLYX_PROACTIVE_ASSISTANT_TRANSLATED_LOCALES,
  explainKlyxProactiveAction,
  getKlyxProactiveAssistantDictionary,
  resolveKlyxProactiveAssistantLocale,
  translateKlyxProactiveAssistant,
} from "@/lib/klyx-proactive-assistant-i18n";

describe("KLYX proactive assistant i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROACTIVE_ASSISTANT_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProactiveAssistantDictionary(locale);

      for (const key of KLYX_PROACTIVE_ASSISTANT_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProactiveAssistantLocale("es")).toBe("fr");
    expect(translateKlyxProactiveAssistant("es", "whyNow")).toBe("Pourquoi maintenant");
  });

  it("keeps payment confirmation explicitly user-controlled", () => {
    expect(explainKlyxProactiveAction("fr", "payment_pending").confirmation).toContain(
      "action explicite"
    );
    expect(explainKlyxProactiveAction("en", "payment_pending").confirmation).toContain(
      "explicit action"
    );
    expect(explainKlyxProactiveAction("nl", "payment_pending").confirmation).toContain(
      "expliciete actie"
    );
    expect(explainKlyxProactiveAction("de", "payment_pending").confirmation).toContain(
      "ausdrückliche Aktion"
    );
  });

  it("keeps provider choice and booking confirmation explicit", () => {
    expect(explainKlyxProactiveAction("en", "compare_offers").confirmation).toContain(
      "your confirmation"
    );
    expect(explainKlyxProactiveAction("en", "finalize_booking").confirmation).toContain(
      "after you confirm"
    );
  });

  it("uses a safe control-preserving fallback for unknown actions", () => {
    expect(explainKlyxProactiveAction("fr", "future_action").confirmation).toBe(
      "Tu gardes toujours le contrôle des actions importantes."
    );
  });
});
