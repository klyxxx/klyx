import { describe, expect, it } from "vitest";

import {
  bestBrainCommandAction,
  hasGeneralBrainCommandIntent,
  hasNewNeedBrainCommandIntent,
  hasSpecificBrainCommandIntent,
  normalizeBrainCommandMessage,
} from "@/lib/brain-command-intent";

describe("KLYX brain command multilingual intent", () => {
  it("normalizes accents and German sharp s safely", () => {
    expect(normalizeBrainCommandMessage("Buchung abschließen")).toBe("buchung abschliessen");
    expect(normalizeBrainCommandMessage("Nächster Schritt")).toBe("nachster schritt");
    expect(normalizeBrainCommandMessage("Réserver demain")).toBe("reserver demain");
  });

  it.each([
    "Que dois-je faire maintenant ?",
    "What should I do now?",
    "Wat moet ik doen?",
    "Was soll ich tun?",
  ])("recognizes general action intent: %s", (message) => {
    expect(hasGeneralBrainCommandIntent(normalizeBrainCommandMessage(message))).toBe(true);
  });

  it.each([
    "J'ai besoin d'un plombier",
    "I need a plumber",
    "Ik heb een loodgieter nodig",
    "Ich brauche einen Klempner",
  ])("recognizes a new need: %s", (message) => {
    expect(hasNewNeedBrainCommandIntent(normalizeBrainCommandMessage(message))).toBe(true);
  });

  it.each([
    "Je veux finaliser le paiement",
    "I want to pay now",
    "Ik wil nu betalen",
    "Ich möchte jetzt bezahlen",
  ])("recognizes a specific existing intent: %s", (message) => {
    expect(hasSpecificBrainCommandIntent(normalizeBrainCommandMessage(message))).toBe(true);
  });

  it("selects the matching action without executing it", () => {
    const actions = [
      { id: "track", kind: "track_mission", priority: 120 },
      { id: "pay", kind: "payment_pending", priority: 100 },
    ];

    const selected = bestBrainCommandAction(
      actions,
      normalizeBrainCommandMessage("I want to pay now")
    );

    expect(selected?.id).toBe("pay");
    expect(actions[0]?.id).toBe("track");
  });

  it("preserves French routing signals", () => {
    expect(hasSpecificBrainCommandIntent(normalizeBrainCommandMessage("suivre ma mission"))).toBe(true);
    expect(hasGeneralBrainCommandIntent(normalizeBrainCommandMessage("ma prochaine action"))).toBe(true);
    expect(hasNewNeedBrainCommandIntent(normalizeBrainCommandMessage("je cherche quelqu un"))).toBe(true);
  });
});
