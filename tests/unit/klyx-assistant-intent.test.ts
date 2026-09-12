import { describe, expect, it } from "vitest";

import { classifyKlyxAssistantIntent } from "@/lib/klyx-assistant-intent";

describe("classifyKlyxAssistantIntent", () => {
  it("recognizes a request to obtain a service", () => {
    expect(
      classifyKlyxAssistantIntent(
        "Trouve-moi quelqu’un pour monter mon armoire demain après 18h."
      ).intent
    ).toBe("service_need");
  });

  it("recognizes a request to find work and income", () => {
    const result = classifyKlyxAssistantIntent(
      "Je suis libre samedi, je veux gagner environ 100 € près de chez moi."
    );

    expect(result.intent).toBe("income_search");
    expect(result.confidence).toBe("high");
  });

  it("recognizes management of an existing mission", () => {
    expect(classifyKlyxAssistantIntent("Où en est ma mission ?").intent).toBe(
      "mission_management"
    );
  });

  it("recognizes an informational question", () => {
    expect(classifyKlyxAssistantIntent("Comment fonctionne KLYX ?").intent).toBe(
      "information"
    );
  });

  it("asks one short question when mission direction is ambiguous", () => {
    const result = classifyKlyxAssistantIntent("Je veux une mission");

    expect(result.intent).toBe("clarification");
    expect(result.clarificationQuestion).toContain("besoin");
    expect(result.clarificationQuestion).toContain("gagner");
  });

  it("does not guess when obtain and earn signals collide", () => {
    const result = classifyKlyxAssistantIntent(
      "Trouve-moi quelqu’un et je veux gagner 100 € samedi."
    );

    expect(result.intent).toBe("clarification");
    expect(result.clarificationQuestion).toContain("trouver quelqu’un");
    expect(result.clarificationQuestion).toContain("mission à réaliser");
  });
});
