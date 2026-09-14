import { describe, expect, it } from "vitest";

import {
  buildPostBookingIncidentMessage,
  evaluatePostBookingIncidentPolicy,
  incidentAllowedForRole,
} from "@/lib/post-booking-incidents";

describe("post-booking incident policy", () => {
  it("routes provider no-show to human review while allowing a client replacement search", () => {
    const decision = evaluatePostBookingIncidentPolicy({
      incidentType: "provider_no_show",
      reporterRole: "client",
      paymentStatus: "paid",
      afterStart: true,
    });

    expect(decision.replacementEligible).toBe(true);
    expect(decision.humanReviewRequired).toBe(true);
    expect(decision.trustCaseType).toBe("no_show");
    expect(decision.refundHandling).toBe("human_review");
    expect(decision.automaticSanctionAllowed).toBe(false);
    expect(decision.llmDecisionAllowed).toBe(false);
  });

  it("keeps a pre-start paid cancellation on the existing refund policy", () => {
    const decision = evaluatePostBookingIncidentPolicy({
      incidentType: "cancellation",
      reporterRole: "client",
      paymentStatus: "paid",
      afterStart: false,
    });

    expect(decision.replacementEligible).toBe(true);
    expect(decision.humanReviewRequired).toBe(false);
    expect(decision.refundHandling).toBe("existing_policy");
  });

  it("does not turn delay into an automatic Trust & Safety verdict", () => {
    const decision = evaluatePostBookingIncidentPolicy({
      incidentType: "delay",
      reporterRole: "client",
      paymentStatus: "paid",
      afterStart: true,
    });

    expect(decision.humanReviewRequired).toBe(false);
    expect(decision.automaticSanctionAllowed).toBe(false);
    expect(decision.llmDecisionAllowed).toBe(false);
  });

  it("rejects a provider reporting a provider no-show and a provider requesting a client replacement", () => {
    expect(incidentAllowedForRole("provider_no_show", "provider")).toBe(false);
    expect(incidentAllowedForRole("replacement_request", "provider")).toBe(false);
    expect(incidentAllowedForRole("client_no_show", "provider")).toBe(true);
  });

  it("produces the explicit-consent replacement message", () => {
    expect(
      buildPostBookingIncidentMessage({
        incidentType: "cancellation",
        replacementCandidateCount: 2,
        humanReviewRequired: false,
        refundHandling: "existing_policy",
      })
    ).toBe(
      "La personne a annulé. J’ai trouvé 2 remplaçants compatibles. Veux-tu que je te présente le meilleur ?"
    );
  });
});
