import { describe, expect, it } from "vitest";

import { buildKlyxProviderAssistantMissionPrompt } from "@/lib/klyx-provider-assistant-mission-prompt";

const context = {
  title: "Deep clean",
  service: "Cleaning",
  city: "Brussels",
  budget: "€120.00",
  description: "Full apartment cleaning",
  matchScore: 92,
};

describe("KLYX provider assistant mission prompt", () => {
  it("localizes the mission handoff instructions", () => {
    expect(buildKlyxProviderAssistantMissionPrompt("fr", context)).toContain(
      "Prépare une réponse professionnelle"
    );
    expect(buildKlyxProviderAssistantMissionPrompt("en", context)).toContain(
      "Prepare a professional reply"
    );
    expect(buildKlyxProviderAssistantMissionPrompt("nl", context)).toContain(
      "professioneel antwoord"
    );
    expect(buildKlyxProviderAssistantMissionPrompt("de", context)).toContain(
      "professionelle Antwort"
    );
  });

  it("keeps real mission context unchanged", () => {
    const prompt = buildKlyxProviderAssistantMissionPrompt("en", context);
    expect(prompt).toContain("Deep clean");
    expect(prompt).toContain("Cleaning");
    expect(prompt).toContain("Brussels");
    expect(prompt).toContain("€120.00");
    expect(prompt).toContain("Full apartment cleaning");
    expect(prompt).toContain("92%");
  });

  it("falls back to French for unsupported locales", () => {
    expect(buildKlyxProviderAssistantMissionPrompt("es", context)).toContain(
      "Prépare une réponse professionnelle"
    );
  });
});
