import { describe, expect, it } from "vitest";

import { translateKlyxAssistantCommand } from "@/lib/klyx-assistant-command-i18n";

describe("KLYX assistant no-action guidance", () => {
  it.each([
    ["fr", ["mission", "paiement", "offre", "nouveau besoin"]],
    ["en", ["job", "payment", "offer", "new need"]],
    ["nl", ["opdracht", "betaling", "offerte", "nieuwe behoefte"]],
    ["de", ["Auftrags", "Zahlung", "Angebots", "neuen Bedarf"]],
  ] as const)("gives a useful next step in %s", (locale, expectedTerms) => {
    const message = translateKlyxAssistantCommand(locale, "noPendingAction");

    expect(message.length).toBeGreaterThan(80);
    for (const term of expectedTerms) {
      expect(message).toContain(term);
    }
  });

  it("keeps unsupported locales on the deterministic French fallback", () => {
    expect(translateKlyxAssistantCommand("es", "noPendingAction")).toBe(
      translateKlyxAssistantCommand("fr", "noPendingAction")
    );
  });
});
