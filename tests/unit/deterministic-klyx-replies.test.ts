import { describe, expect, it } from "vitest";

import { getDeterministicKlyxReply } from "@/lib/brain/deterministic-replies";

describe("deterministic KLYX replies", () => {
  it("answers simple greetings locally", () => {
    expect(getDeterministicKlyxReply("Bonjour")).toContain("Bonjour");
  });

  it("does not swallow an actionable request that starts with a greeting", () => {
    expect(
      getDeterministicKlyxReply(
        "Bonjour, trouve-moi un déménageur demain à Bruxelles avec deux personnes."
      )
    ).toBeNull();
  });

  it("answers common KLYX capability questions locally", () => {
    const reply = getDeterministicKlyxReply("Que peut faire KLYX ?");
    expect(reply).toContain("comprendre un besoin");
    expect(reply).toContain("paiements");
  });

  it("answers simple budget framing locally without inventing prices", () => {
    const reply = getDeterministicKlyxReply("Combien coûte un service ?");
    expect(reply).toContain("ville");
    expect(reply).toContain("prix réel");
  });

  it("keeps complex arbitrary requests eligible for the LLM path", () => {
    expect(
      getDeterministicKlyxReply(
        "Compare plusieurs stratégies de remplacement après une annulation complexe avec contraintes horaires."
      )
    ).toBeNull();
  });
});
