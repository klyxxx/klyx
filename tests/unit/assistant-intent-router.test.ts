import { describe, expect, it } from "vitest";

import { routeAssistantIntent } from "../../lib/assistant-intent-router";

describe("routeAssistantIntent", () => {
  it("routes a service need", () => {
    expect(
      routeAssistantIntent(
        "Trouve-moi quelqu’un pour monter mon armoire demain après 18h.",
        { locale: "fr" }
      ).intent
    ).toBe("service_need");
  });

  it("routes an income search", () => {
    const result = routeAssistantIntent(
      "Je suis libre samedi, je veux gagner environ 100 € près de chez moi.",
      { locale: "fr" }
    );

    expect(result.intent).toBe("income_search");
    expect(result.confidence).not.toBe("low");
  });

  it("routes management of an existing mission", () => {
    expect(
      routeAssistantIntent("Où en est ma mission de demain ?", {
        locale: "fr",
      }).intent
    ).toBe("mission_management");
  });

  it("routes an informational question", () => {
    expect(
      routeAssistantIntent("Comment fonctionne le paiement sur KLYX ?", {
        locale: "fr",
      }).intent
    ).toBe("information");
  });

  it("keeps the previous intent for a short follow-up", () => {
    expect(
      routeAssistantIntent("Samedi vers 18h", {
        locale: "fr",
        previousIntent: "income_search",
      }).intent
    ).toBe("income_search");
  });

  it("asks one short clarification when intent is unresolved", () => {
    const result = routeAssistantIntent("J’aimerais faire quelque chose samedi", {
      locale: "fr",
    });

    expect(result.intent).toBe("clarification");
    expect(result.clarificationQuestion).toContain("service");
    expect(result.clarificationQuestion).toContain("missions rémunérées");
  });
});
