import { describe, expect, it } from "vitest";

import {
  bestSpecificBrainCommandAction,
  hasGeneralBrainCommandIntent,
  hasNewNeedBrainCommandIntent,
  hasSpecificBrainCommandIntent,
  normalizeBrainCommandMessage,
} from "../../lib/brain-command-intent";

const normalize = (value: string) => normalizeBrainCommandMessage(value);

describe("brain command natural status intents", () => {
  it.each([
    "Qu’est-ce qui bloque ?",
    "J’attends quoi ?",
    "What am I waiting for?",
    "What is blocking?",
    "Waar wacht ik op?",
    "Wat blokkeert?",
    "Worauf warte ich?",
    "Was blockiert?",
  ])("recognizes a grounded status question: %s", (message) => {
    expect(hasGeneralBrainCommandIntent(normalize(message))).toBe(true);
  });

  it.each([
    "C’est payé ?",
    "Est-ce payé ?",
    "Is it paid?",
    "Has it been paid?",
    "Is het betaald?",
    "Al betaald?",
    "Ist es bezahlt?",
    "Schon bezahlt?",
  ])("recognizes a payment-status question: %s", (message) => {
    expect(hasSpecificBrainCommandIntent(normalize(message))).toBe(true);
  });

  it("returns only an action matching a specific status intent", () => {
    const actions = [
      {
        kind: "track_mission",
        priority: 900,
      },
      {
        kind: "payment_pending",
        priority: 100,
      },
    ];

    expect(
      bestSpecificBrainCommandAction(actions, normalize("C’est payé ?"))
    ).toEqual(actions[1]);
  });

  it("returns no action when a specific status intent has no matching action", () => {
    const actions = [
      {
        kind: "track_mission",
        priority: 900,
      },
    ];

    expect(
      bestSpecificBrainCommandAction(actions, normalize("C’est payé ?"))
    ).toBeNull();
  });

  it("preserves explicit new service needs as new needs", () => {
    const message = normalize("J’ai besoin d’un plombier demain");

    expect(hasNewNeedBrainCommandIntent(message)).toBe(true);
    expect(hasGeneralBrainCommandIntent(message)).toBe(false);
    expect(hasSpecificBrainCommandIntent(message)).toBe(false);
  });

  it("does not turn ordinary service text into a status intent", () => {
    const message = normalize("Nettoyage demain matin");

    expect(hasGeneralBrainCommandIntent(message)).toBe(false);
    expect(hasSpecificBrainCommandIntent(message)).toBe(false);
  });
});
