import { describe, expect, it } from "vitest";

import {
  evaluateEconomicEligibility,
  type EconomicEligibilityInput,
} from "@/lib/economic-eligibility-engine";

function input(): EconomicEligibilityInput {
  return {
    account: { id: "acct_1", status: "active" },
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
        id: "verification_1",
        subjectId: "legal_1",
        type: "identity",
        status: "verified",
      },
    ],
    qualifications: [
      {
        id: "qualification_1",
        accountId: "acct_1",
        key: "professional-proof",
        status: "verified",
      },
    ],
    activityEligibility: {
      id: "activity_1",
      accountId: "acct_1",
      activityKey: "repair",
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
      qualificationKeys: ["professional-proof"],
    },
    context: {
      action: "settlement",
      activityKey: "repair",
      countryCode: "BE",
      evaluatedAt: "2026-09-24T18:00:00.000Z",
    },
  };
}

describe("economic eligibility fail-closed evidence aggregation", () => {
  it("blocks when one applicable verification contradicts another verified record", () => {
    const fixture = input();
    fixture.verifications = [
      ...fixture.verifications,
      {
        id: "verification_2",
        subjectId: "legal_1",
        type: "identity",
        status: "restricted",
      },
    ];

    const result = evaluateEconomicEligibility(fixture);

    expect(result.state).toBe("restricted");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("VERIFICATION_RESTRICTED");
  });

  it("blocks when one applicable qualification is expired even if another is verified", () => {
    const fixture = input();
    fixture.qualifications = [
      ...fixture.qualifications,
      {
        id: "qualification_2",
        accountId: "acct_1",
        key: "professional-proof",
        status: "expired",
      },
    ];

    const result = evaluateEconomicEligibility(fixture);

    expect(result.state).toBe("expired");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("QUALIFICATION_EXPIRED");
  });

  it("blocks a provider marked ready when the canonical external account reference is missing", () => {
    const fixture = input();
    fixture.externalPaymentProvider.externalAccountRef = null;

    const result = evaluateEconomicEligibility(fixture);

    expect(result.state).toBe("restricted");
    expect(result.authorized).toBe(false);
    expect(result.reasonCodes).toContain("EXTERNAL_PROVIDER_ACCOUNT_MISSING");
  });
});
