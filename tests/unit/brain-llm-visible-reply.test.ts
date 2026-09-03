import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildKlyxVisibleReplyPrompt,
  isSafeKlyxVisibleLead,
  selectKlyxVisibleReply,
} from "../../lib/brain/llm/visible-reply";

describe("KLYX Brain visible LLM reply policy", () => {
  const deterministicReply =
    "Demande en cours (50 %)\n\nJ’ai déjà compris : ménage à Bruxelles. Quel jour souhaites-tu la prestation ?";
  const groundingText =
    `Je cherche un ménage à Bruxelles.\n${deterministicReply}`;

  it("keeps the deterministic reply intact when OpenAI is unavailable", () => {
    const result = selectKlyxVisibleReply({
      deterministicReply,
      candidateText: "J’ai compris.",
      candidateMode: "fallback",
      groundingText,
    });

    expect(result.text).toBe(deterministicReply);
    expect(result.usedLlm).toBe(false);
    expect(result.deterministicCorePreserved).toBe(true);
    expect(result.automaticExecutionAllowed).toBe(false);
  });

  it("shows a safe grounded LLM lead without changing deterministic facts", () => {
    const result = selectKlyxVisibleReply({
      deterministicReply,
      candidateText: "J’ai bien compris. Voici la prochaine étape utile.",
      candidateMode: "openai",
      groundingText,
    });

    expect(result.usedLlm).toBe(true);
    expect(result.lead).toBe(
      "J’ai bien compris. Voici la prochaine étape utile.",
    );
    expect(result.text.endsWith(deterministicReply)).toBe(true);
    expect(result.text).toContain("ménage à Bruxelles");
  });

  it("rejects transactional or availability claims", () => {
    expect(
      isSafeKlyxVisibleLead({
        candidate: "J’ai trouvé un prestataire disponible.",
        groundingText,
      }),
    ).toBe(false);

    expect(
      selectKlyxVisibleReply({
        deterministicReply,
        candidateText: "La réservation est confirmée.",
        candidateMode: "openai",
        groundingText,
      }).text,
    ).toBe(deterministicReply);
  });

  it("rejects new numeric or pricing claims", () => {
    expect(
      isSafeKlyxVisibleLead({
        candidate: "Le tarif sera de 85 €.",
        groundingText,
      }),
    ).toBe(false);
  });

  it("rejects ungrounded new content words", () => {
    expect(
      isSafeKlyxVisibleLead({
        candidate: "Un plombier devrait convenir.",
        groundingText,
      }),
    ).toBe(false);
  });

  it("constrains the generation prompt to verified KLYX state", () => {
    const prompt = buildKlyxVisibleReplyPrompt({
      userMessage: "Je cherche un ménage à Bruxelles.",
      deterministicReply,
    });

    expect(prompt).toContain("Message utilisateur");
    expect(prompt).toContain("Réponse KLYX vérifiée");
    expect(prompt).toContain(deterministicReply);
    expect(prompt).toContain("N’ajoute aucun fait");
  });
});
