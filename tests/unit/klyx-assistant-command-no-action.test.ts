import { describe, expect, it } from "vitest";

import { translateKlyxAssistantCommand } from "@/lib/klyx-assistant-command-i18n";

describe("KLYX assistant no-action guidance", () => {
  it.each([
    ["fr", ["mission", "nouveau besoin"], ["paiement", "offre"]],
    ["en", ["mission", "new need"], ["payment", "offer"]],
    ["nl", ["missie", "nieuwe behoefte"], ["betaling", "offerte"]],
    ["de", ["Mission", "neuen Bedarf"], ["Zahlung", "Angebot"]],
  ] as const)(
    "keeps %s guidance conversational and non-transactional",
    (locale, expectedTerms, forbiddenTerms) => {
      const message = translateKlyxAssistantCommand(locale, "noPendingAction");

      expect(message.length).toBeGreaterThan(80);
      for (const term of expectedTerms) {
        expect(message).toContain(term);
      }
      for (const term of forbiddenTerms) {
        expect(message).not.toContain(term);
      }
    }
  );

  it("keeps unsupported locales on the deterministic French fallback", () => {
    expect(translateKlyxAssistantCommand("es", "noPendingAction")).toBe(
      translateKlyxAssistantCommand("fr", "noPendingAction")
    );
  });
});
