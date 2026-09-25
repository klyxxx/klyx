import { describe, expect, it } from "vitest";

import {
  evaluateSettlementEligibilitySnapshot,
  type SettlementEligibilitySourceSnapshot,
} from "@/lib/economic-settlement-eligibility-adapter";

function baseline(): SettlementEligibilitySourceSnapshot {
  return {
    accountId: "acct_1",
    accountExists: true,
    offerServicesEnabled: true,
    economicIdentity: {
      id: "econ_1",
      status: "ready",
      humanReviewRequired: false,
      reviewReasonCode: null,
    },
    legalSubjects: [
      {
        id: "person_1",
        kind: "person",
        isPrimary: true,
        verificationStatus: "verified",
        expiresAt: null,
      },
    ],
    verifications: [
      {
        id: "verification_1",
        verificationType: "kyc",
        status: "verified",
        humanReviewRequired: false,
        legalEntityId: null,
        economicPersonId: "person_1",
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
    ],
    qualifications: [
      {
        id: "qualification_1",
        qualificationKey: "service_credential",
        scopeType: "activity",
        scopeKey: "cleaning",
        activityKey: "cleaning",
        jurisdictionCode: "BE",
        status: "approved",
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2030-01-01T00:00:00.000Z",
      },
    ],
    economicRestrictions: [],
    trustRestrictions: [],
    trustDecisions: [
      {
        id: "trust_1",
        targetType: "booking",
        targetRef: "booking_1",
        decision: "eligible",
        humanReviewRequired: false,
        reviewStatus: "not_required",
        reasonCodes: [],
        requiredActions: [],
        createdAt: "2026-09-24T10:00:00.000Z",
        expiresAt: "2026-09-24T22:00:00.000Z",
      },
    ],
    canonicalExternalIdentity: {
      identityState: "linked",
      externalAccountRef: "acct_external_1",
    },
    externalProviderProjection: {
      economicIdentityId: "econ_1",
      accountId: "acct_1",
      externalAccountRef: "acct_external_1",
      payoutsEnabled: true,
      currentlyDue: [],
      pastDue: [],
      pendingVerification: [],
      requirementErrors: [],
      disabledReason: null,
      capabilities: { transfers: "active" },
    },
    context: {
      activityKey: "cleaning",
      jurisdictionCode: "BE",
      subjectType: "booking",
      subjectId: "booking_1",
      userServiceId: "user_service_1",
      expectedExternalAccountRef: "acct_external_1",
      evaluatedAt: "2026-09-24T12:00:00.000Z",
    },
    previous: null,
  };
}

describe("economic settlement eligibility adapter", () => {
  it("allows a fully verified chain", () => {
    const result = evaluateSettlementEligibilitySnapshot(baseline());
    expect(result.decision).toBe("allowed");
    expect(result.reasonCodes).toEqual([]);
    expect(result.engineResult.authorized).toBe(true);
    expect(result.evidenceSnapshot.engineAuditEvent).toBeDefined();
  });

  it("blocks settlement when KLYX country eligibility blocks while provider is ready", () => {
    const input = baseline();
    input.economicRestrictions = [
      {
        id: "restriction_1",
        restrictedAction: "receive_settlement",
        scopeType: "jurisdiction",
        activityKey: null,
        jurisdictionCode: "BE",
        status: "active",
        reasonCode: "market_restricted",
        humanReviewRequired: false,
        startsAt: "2026-09-24T00:00:00.000Z",
        endsAt: null,
      },
    ];

    const result = evaluateSettlementEligibilitySnapshot(input);
    expect(input.externalProviderProjection?.capabilities).toEqual({
      transfers: "active",
    });
    expect(result.decision).toBe("blocked");
    expect(result.engineResult.authorized).toBe(false);
    expect(result.reasonCodes).toContain("ECONOMIC_COUNTRY_RESTRICTED");
    expect(result.reasonCodes).not.toContain("STRIPE_TRANSFER_CAPABILITY_INACTIVE");
  });

  it("keeps payouts_enabled false informational when settlement transfer capability is active", () => {
    const input = baseline();
    if (!input.externalProviderProjection) throw new Error("fixture projection missing");
    input.externalProviderProjection.payoutsEnabled = false;

    const result = evaluateSettlementEligibilitySnapshot(input);
    expect(result.decision).toBe("allowed");
    expect(result.engineResult.authorized).toBe(true);
  });

  it("blocks an inactive settlement capability", () => {
    const input = baseline();
    if (!input.externalProviderProjection) throw new Error("fixture projection missing");
    input.externalProviderProjection.capabilities = { transfers: "inactive" };

    const result = evaluateSettlementEligibilitySnapshot(input);
    expect(result.decision).toBe("blocked");
    expect(result.reasonCodes).toContain("STRIPE_TRANSFER_CAPABILITY_INACTIVE");
  });

  it("blocks a required missing qualification", () => {
    const input = baseline();
    input.qualifications = [];
    input.trustDecisions = [
      {
        ...input.trustDecisions[0],
        decision: "eligible_with_conditions",
        requiredActions: [{ code: "QUALIFICATION_REQUIRED" }],
      },
    ];

    const result = evaluateSettlementEligibilitySnapshot(input);
    expect(result.decision).toBe("blocked");
    expect(result.reasonCodes).toContain("ACCOUNT_QUALIFICATION_MISSING");
  });

  it("propagates previous state into the immutable audit event", () => {
    const input = baseline();
    input.previous = { state: "restricted", decision: "blocked" };

    const result = evaluateSettlementEligibilitySnapshot(input);
    expect(result.engineResult.auditEvent.previousState).toEqual({
      state: "restricted",
      decision: "blocked",
    });
    expect(result.engineResult.auditEvent.newState).toEqual({
      state: "verified",
      decision: "allowed",
      authorized: true,
    });
  });
});
