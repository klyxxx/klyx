import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  finalizeProviderUnknownAiReply,
} from "../../lib/provider-assistant-visible-ai";

const DETERMINISTIC_REPLY =
  "Je peux préparer une disponibilité, un devis ou une réponse client. Exemple : « Je suis libre jeudi de 9 h à 14 h ».";

const LOCKED_FACTS = {
  intent: "unknown",
  title: "Demande à préciser",
  draftId: null,
  payload: {},
};

describe("provider unknown visible AI safety", () => {
  it("keeps a safe OpenAI reply after deterministic validation", () => {
    const result = finalizeProviderUnknownAiReply({
      aiMode: "openai",
      candidate:
        "Je peux vous aider à préciser votre demande pour préparer la bonne action KLYX.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({
      reply:
        "Je peux vous aider à préciser votre demande pour préparer la bonne action KLYX.",
      aiMode: "openai",
    });
  });

  it("falls back deterministically when OpenAI invents a transaction state", () => {
    const result = finalizeProviderUnknownAiReply({
      aiMode: "openai",
      candidate: "Votre réservation est confirmée.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({
      reply: DETERMINISTIC_REPLY,
      aiMode: "fallback",
    });
  });

  it("keeps the deterministic fallback when the first model call falls back", () => {
    const result = finalizeProviderUnknownAiReply({
      aiMode: "fallback",
      candidate: "Réponse de secours générique.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({
      reply: DETERMINISTIC_REPLY,
      aiMode: "fallback",
    });
  });

  it("finalizes unknown and mission-plan replies before the visible AI wrapper can call a model", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "app/api/provider/assistant/assistant-route-visible.ts"
      ),
      "utf8"
    );
    const unknownGuard = source.indexOf(
      'responseBody.intent === "unknown"'
    );
    const missionPlanGuard = source.indexOf(
      'responseBody.intent === "mission_plan"',
      unknownGuard
    );
    const finalReturn = source.indexOf("return response;", missionPlanGuard);
    const visibleAiCall = source.indexOf(
      "await generateKlyxVisibleAiReply",
      finalReturn
    );

    expect(unknownGuard).toBeGreaterThan(-1);
    expect(missionPlanGuard).toBeGreaterThan(unknownGuard);
    expect(finalReturn).toBeGreaterThan(missionPlanGuard);
    expect(visibleAiCall).toBeGreaterThan(finalReturn);
  });
});
