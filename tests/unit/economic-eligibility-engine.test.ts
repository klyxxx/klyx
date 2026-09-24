import { describe, expect, it } from "vitest";

import {
  evaluateEconomicEligibility,
  settlementIsAuthorized,
  type EconomicEligibilityInput,
} from "@/lib/economic-eligibility-engine";

function verifiedInput(): EconomicEligibilityInput {
  return {
    account: {
      id: "acct_1",
      status: "active",
    },
    economicIdentity: {
      id: "econ_1",
      accountId: "acct_1",
      status: "verified",
    },
    legalSubject: {
      id: "legal_1",
      economicIdentityId: "econ_1",
      kind: "person",
      status: "verified",
    },
    verifications: [
      {
        id: "verification_identity_1",
        subjectId: "legal_1",
        type: "identity",
        status: "verified",
      },
    ],
    qualifications: [
      {
        id: "qualification_service_1",
        accountId: "acct_1",
        key: "service-professional-proof",
        status: "verified",
      },
    ],
    activityEligibility: {
      id: "activity_1",
      accountId: "acct_1",
      activityKey: "home-repair",
      countryCode: "BE",
      status: "verified",
      countryStatus: "allowed",
    },
    externalPaymentProvider: {
      provider: "mockpay",
      economicIdentityId: "econ_1",
      externalAccountRef: "recipient_1",
      status: "ready",
      settlementEnabled: true,
      payoutsEnabled: true,
      requirementsDue: [],
    },
    requirements: {
      verificationTypes: ["identity"],
      qualificationKeys: ["service-professional-proof"],
    },
    context: {
      action: "settlement",
      activityKey: "home-repair",
      countryCode: "BE",
      evaluatedAt: "2026-09-24T18:00:00.000Z",
    },
    previous: null,
  };
}

function cloneInput(): EconomicEligibilityInput {
  return structuredClone(verifiedInput());
}

describe("pure KLYX economic eligibility engine", () => {
  it("allows a fully verified settlement without any Supabase or payment-provider SDK state", () => {
    const result = evaluateEconomicEligibility(verifiedInput());

    expect(result.state).toBe("verified");
    expect(result.decision).toBe("allowed");
    expect(result.authorized).toBe(true);
    expect(settlementIsAuthorized(result)).toBe(true);
    expect(result.reasonCodes).toEqual(["ALL_KLYX_AUTHORITIES_VERIFIED"]);
    expect(result.auditEvent.newState).toEqual({
      state: "verified",
      decision: "allowed",
      authorized: true,
    });
  });

  it("blocks pending economic identity", () => {
    const input = cloneInput();
    input.economicIdentity.status = "pending";

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("pending");
    expect(result.decision).toBe("blocked");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("ECONOMIC_IDENTITY_PENDING");
  });

  it("blocks expired legal person/entity", () => {
    const input = cloneInput();
    input.legalSubject.status = "expired";

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("expired");
    expect(result.decision).toBe("blocked");
    expect(result.reasonCodes).toContain("LEGAL_SUBJECT_EXPIRED");
  });

  it("blocks restricted verification", () => {
    const input = cloneInput();
    input.verifications = [
      {
        ...input.verifications[0],
        status: "restricted",
      },
    ];

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("restricted");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("VERIFICATION_RESTRICTED");
  });

  it("fails closed when a required verification is missing", () => {
    const input = cloneInput();
    input.verifications = [];

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("pending");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("VERIFICATION_MISSING");
  });

  it("blocks when a required qualification is missing", () => {
    const input = cloneInput();
    input.qualifications = [];

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("qualification_missing");
    expect(result.decision).toBe("blocked");
    expect(result.reasonCodes).toContain("QUALIFICATION_MISSING");
  });

  it("blocks country-restricted activity without hard-coding any country", () => {
    const input = cloneInput();
    input.activityEligibility.countryStatus = "restricted";

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("country_restricted");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("COUNTRY_RESTRICTED");
  });

  it("returns human_review and forbids new settlement while review is unresolved", () => {
    const input = cloneInput();
    input.economicIdentity.status = "human_review";

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("human_review");
    expect(result.decision).toBe("human_review");
    expect(result.authorized).toBe(false);
    expect(settlementIsAuthorized(result)).toBe(false);
    expect(result.reasonCodes).toContain("ECONOMIC_IDENTITY_HUMAN_REVIEW");
  });

  it("blocks settlement-scoped provider requirements due", () => {
    const input = cloneInput();
    input.externalPaymentProvider.requirementsDue = [
      { code: "owners.verification", scope: "settlement" },
    ];

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("requirements_due");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("EXTERNAL_REQUIREMENTS_DUE");
  });

  it("blocks settlement when the external settlement rail is disabled", () => {
    const input = cloneInput();
    input.externalPaymentProvider.settlementEnabled = false;

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("payouts_disabled");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("EXTERNAL_SETTLEMENT_DISABLED");
  });

  it("does not confuse disabled bank payouts with an enabled settlement transfer rail", () => {
    const input = cloneInput();
    input.externalPaymentProvider.payoutsEnabled = false;
    input.externalPaymentProvider.settlementEnabled = true;

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("verified");
    expect(result.decision).toBe("allowed");
    expect(result.authorized).toBe(true);
    expect(settlementIsAuthorized(result)).toBe(true);
  });

  it("blocks payout action when payouts are disabled", () => {
    const input = cloneInput();
    input.context.action = "payout";
    input.externalPaymentProvider.payoutsEnabled = false;

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("payouts_disabled");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("EXTERNAL_PAYOUTS_DISABLED");
  });

  it("enforces the critical invariant: external provider OK plus KLYX blocked equals no settlement", () => {
    const input = cloneInput();
    input.externalPaymentProvider.status = "ready";
    input.externalPaymentProvider.settlementEnabled = true;
    input.externalPaymentProvider.payoutsEnabled = true;
    input.externalPaymentProvider.requirementsDue = [];
    input.activityEligibility.countryStatus = "restricted";

    const result = evaluateEconomicEligibility(input);

    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authority: "external_payment_provider",
          code: "EXTERNAL_PROVIDER_READY",
          blocking: false,
        }),
      ])
    );
    expect(result.reasonCodes).toContain("COUNTRY_RESTRICTED");
    expect(result.authorized).toBe(false);
    expect(settlementIsAuthorized(result)).toBe(false);
  });

  it("fails closed when authority ownership links do not match", () => {
    const input = cloneInput();
    input.externalPaymentProvider.economicIdentityId = "econ_other";

    const result = evaluateEconomicEligibility(input);

    expect(result.state).toBe("restricted");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("EXTERNAL_PROVIDER_IDENTITY_MISMATCH");
  });

  it("produces deterministic decisions, evidence and audit events for identical inputs", () => {
    const input = verifiedInput();

    const first = evaluateEconomicEligibility(input);
    const second = evaluateEconomicEligibility(structuredClone(input));

    expect(second).toEqual(first);
  });

  it("records previous state and new state in every audit event", () => {
    const input = cloneInput();
    input.previous = {
      state: "pending",
      decision: "blocked",
    };

    const result = evaluateEconomicEligibility(input);

    expect(result.auditEvent.previousState).toEqual({
      state: "pending",
      decision: "blocked",
    });
    expect(result.auditEvent.newState).toEqual({
      state: "verified",
      decision: "allowed",
      authorized: true,
    });
    expect(result.auditEvent.reasonCodes).toEqual(result.reasonCodes);
    expect(result.auditEvent.evidence).toEqual(result.evidence);
  });
});
