import { describe, expect, it } from "vitest";

import {
  KLYX_ASSISTANT_ENGINE_CATALOG,
  KLYX_LLM_FORBIDDEN_DECISIONS,
  routeKlyxAssistantCapability,
} from "../../lib/assistant-capability-router";

describe("KLYX assistant capability control plane", () => {
  it("routes product questions to the free deterministic layer", () => {
    expect(routeKlyxAssistantCapability("Comment fonctionne KLYX ?")).toMatchObject({
      capability: "klyx_information",
      costMode: "deterministic_free",
      delegateToLegacy: false,
      llmAllowed: false,
    });
  });

  it("never gives the LLM authority over sensitive domains", () => {
    expect(
      routeKlyxAssistantCapability("Explique-moi comment fonctionne le paiement")
    ).toMatchObject({
      capability: "payment_explanation",
      risk: "sensitive_domain",
      llmAllowed: false,
    });
    expect(
      routeKlyxAssistantCapability("Pourquoi mon remboursement fonctionne comme ça ?")
    ).toMatchObject({
      capability: "refund_explanation",
      risk: "sensitive_domain",
      llmAllowed: false,
    });
    expect(
      routeKlyxAssistantCapability("Où en est mon KYC Sumsub ?")
    ).toMatchObject({
      capability: "kyc_explanation",
      costMode: "engine_read",
      wantsLiveStatus: true,
      llmAllowed: false,
    });

    expect(KLYX_LLM_FORBIDDEN_DECISIONS).toEqual(
      expect.arrayContaining([
        "payment",
        "kyc",
        "eligibility",
        "settlement",
        "refund",
        "sensitive_mutation",
      ])
    );
  });

  it("keeps service, request and booking flows on existing deterministic engines", () => {
    expect(
      routeKlyxAssistantCapability("Trouve-moi un prestataire pour un service")
    ).toMatchObject({
      capability: "service_search",
      engines: ["supabase", "matching"],
      delegateToLegacy: true,
      llmAllowed: false,
    });
    expect(
      routeKlyxAssistantCapability("Créer une demande de ménage")
    ).toMatchObject({
      capability: "request_creation",
      engines: ["supabase", "matching"],
      delegateToLegacy: true,
      llmAllowed: false,
    });
    expect(
      routeKlyxAssistantCapability("Où en est ma réservation ?")
    ).toMatchObject({
      capability: "booking_tracking",
      delegateToLegacy: true,
      wantsLiveStatus: true,
      llmAllowed: false,
    });
  });

  it("changes supported languages deterministically through Tolgee", () => {
    expect(routeKlyxAssistantCapability("Passe en néerlandais")).toMatchObject({
      capability: "language_change",
      targetLocale: "nl",
      engines: ["tolgee"],
      costMode: "deterministic_free",
      llmAllowed: false,
    });
    expect(routeKlyxAssistantCapability("Switch language to English")).toMatchObject({
      capability: "language_change",
      targetLocale: "en",
    });
  });

  it("registers every external/internal engine behind the assistant", () => {
    expect(Object.keys(KLYX_ASSISTANT_ENGINE_CATALOG)).toEqual(
      expect.arrayContaining([
        "supabase",
        "matching",
        "sumsub",
        "stripe",
        "twilio",
        "resend",
        "tolgee",
        "booking",
        "refund",
        "ledger",
        "klyx_knowledge",
      ])
    );
  });

  it("uses LLM only as a fallback when deterministic routing has no answer", () => {
    expect(
      routeKlyxAssistantCapability("J'ai une question très particulière")
    ).toMatchObject({
      capability: "legacy",
      costMode: "llm_fallback",
      delegateToLegacy: true,
      llmAllowed: true,
    });
  });
});
