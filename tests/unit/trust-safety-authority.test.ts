import { describe, expect, it } from "vitest";

import {
  evaluateTrustSafetyAuthority,
  type TrustSafetyCategoryPolicy,
  type TrustSafetyFacts,
} from "@/lib/trust-safety-authority";

const policy: TrustSafetyCategoryPolicy = {
  jurisdictionCountryCode: "BE",
  categoryKey: "cleaning",
  riskTier: "standard",
  requiredIdentityLevel: "basic",
  minimumTrustLevel: "limited",
  requiredQualifications: [],
  requiredVerifications: [],
  allowedLegalPaths: [
    "occasional_compatible",
    "employment_via_structure",
    "professional_independent",
  ],
  humanReviewMode: "never",
};

function facts(overrides: Partial<TrustSafetyFacts> = {}): TrustSafetyFacts {
  return {
    jurisdictionCountryCode: "BE",
    identityLevel: "verified",
    trustLevel: "standard",
    declaredLegalPath: "occasional_compatible",
    activityFrequency: "one_off",
    legalPathReview: "approved",
    reviewedLegalPath: "occasional_compatible",
    qualifications: {},
    verifications: {},
    restrictions: [],
    unresolvedSafetyReports: 0,
    unresolvedFraudReports: 0,
    unresolvedNoShows: 0,
    unresolvedDisputes: 0,
    ...overrides,
  };
}

describe("Trust & Safety authority", () => {
  it("is eligible only from explicit facts and a matching human-reviewed legal pathway", () => {
    const authority = evaluateTrustSafetyAuthority({ facts: facts(), policy });

    expect(authority.decision).toBe("eligible");
    expect(authority.legalClassificationAutomatic).toBe(false);
    expect(authority.reversible).toBe(true);
    expect(authority.reasons).toContain("LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC");
  });

  it("requires enterprise and social-insurance verification for the operational independent path", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({
        declaredLegalPath: "professional_independent",
        reviewedLegalPath: "professional_independent",
        verifications: {},
      }),
    });

    expect(authority.decision).toBe("conditional");
    expect(authority.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "verification",
          key: "enterprise_registration",
          status: "missing",
        }),
        expect.objectContaining({
          kind: "verification",
          key: "social_insurance_fund",
          status: "missing",
        }),
      ])
    );
  });

  it("allows the operational independent path once evidence and human review are present", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({
        declaredLegalPath: "professional_independent",
        reviewedLegalPath: "professional_independent",
        verifications: {
          enterprise_registration: "verified",
          social_insurance_fund: "verified",
        },
      }),
    });

    expect(authority.decision).toBe("eligible");
  });

  it("requires an actual verified employment arrangement for the employment-via-structure path", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({
        declaredLegalPath: "employment_via_structure",
        reviewedLegalPath: "employment_via_structure",
      }),
    });

    expect(authority.decision).toBe("conditional");
    expect(authority.requirements).toContainEqual(
      expect.objectContaining({
        key: "employment_arrangement",
        status: "missing",
      })
    );
  });

  it("does not treat recurring work as automatically compatible with the occasional pathway", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({ activityFrequency: "recurring" }),
    });

    expect(authority.decision).toBe("manual_review");
    expect(authority.reasons).toContain(
      "OCCASIONAL_PATH_CONFLICTS_WITH_RECURRING_ACTIVITY"
    );
  });

  it("escalates unresolved safety and fraud signals to human review without auto-suspending", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({ unresolvedSafetyReports: 1, unresolvedFraudReports: 1 }),
    });

    expect(authority.decision).toBe("manual_review");
    expect(authority.requirements.some((item) => item.status === "blocked")).toBe(false);
    expect(authority.reasons).toEqual(
      expect.arrayContaining([
        "UNRESOLVED_SAFETY_REPORT_REQUIRES_REVIEW",
        "UNRESOLVED_FRAUD_REPORT_REQUIRES_REVIEW",
      ])
    );
  });

  it("keeps no-show and dispute history as signals rather than automatic penalties", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({ unresolvedNoShows: 3, unresolvedDisputes: 2 }),
    });

    expect(authority.decision).toBe("eligible");
    expect(authority.reasons).toContain("NO_SHOW_HISTORY_IS_SIGNAL_NOT_AUTOMATIC_PENALTY");
    expect(authority.reasons).toContain("DISPUTE_HISTORY_IS_SIGNAL_NOT_AUTOMATIC_PENALTY");
  });

  it("blocks only when an explicit active human restriction applies", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy,
      facts: facts({
        restrictions: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            scope: "category",
            categoryKey: "cleaning",
            action: "category_block",
            status: "active",
            reasonCode: "SAFETY_REVIEW_CONFIRMED",
            explanation: "Human-reviewed restriction after documented safety evidence.",
            endsAt: null,
            reviewStatus: "not_requested",
          },
        ],
      }),
    });

    expect(authority.decision).toBe("blocked");
    expect(authority.humanReviewRequired).toBe(true);
    expect(authority.requirements).toContainEqual(
      expect.objectContaining({
        kind: "category_restriction",
        status: "blocked",
        reasonCode: "SAFETY_REVIEW_CONFIRMED",
      })
    );
  });

  it("keeps rejected evidence reviewable rather than silently converting it into a legal status", () => {
    const authority = evaluateTrustSafetyAuthority({
      policy: { ...policy, requiredQualifications: ["regulated_skill"] },
      facts: facts({ qualifications: { regulated_skill: "rejected" } }),
    });

    expect(authority.decision).toBe("manual_review");
    expect(authority.legalClassificationAutomatic).toBe(false);
    expect(authority.sensitiveDecision).toBe(true);
  });
});
