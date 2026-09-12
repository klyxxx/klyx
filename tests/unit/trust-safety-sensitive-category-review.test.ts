import { describe, expect, it } from "vitest";

import {
  evaluateTrustSafetyAuthority,
  type TrustSafetyCategoryPolicy,
  type TrustSafetyFacts,
} from "@/lib/trust-safety-authority";

const policy: TrustSafetyCategoryPolicy = {
  jurisdictionCountryCode: "BE",
  categoryKey: "babysitting",
  riskTier: "sensitive",
  requiredIdentityLevel: "verified",
  minimumTrustLevel: "standard",
  requiredQualifications: [],
  requiredVerifications: [],
  allowedLegalPaths: [
    "occasional_compatible",
    "employment_via_structure",
    "professional_independent",
  ],
  humanReviewMode: "if_sensitive",
};

function facts(
  categoryReview: "unknown" | "pending" | "verified" | "rejected"
): TrustSafetyFacts {
  return {
    jurisdictionCountryCode: "BE",
    identityLevel: "verified",
    trustLevel: "standard",
    declaredLegalPath: "occasional_compatible",
    activityFrequency: "one_off",
    legalPathReview: "approved",
    reviewedLegalPath: "occasional_compatible",
    qualifications: {},
    verifications: {
      "category_review:babysitting": categoryReview,
    },
    restrictions: [],
    unresolvedSafetyReports: 0,
    unresolvedFraudReports: 0,
    unresolvedNoShows: 0,
    unresolvedDisputes: 0,
  };
}

describe("sensitive category review", () => {
  it("requires a human review while the category review is unknown", () => {
    const authority = evaluateTrustSafetyAuthority({
      facts: facts("unknown"),
      policy,
    });

    expect(authority.decision).toBe("manual_review");
    expect(authority.requirements).toContainEqual(
      expect.objectContaining({
        kind: "human_review",
        key: "category_review:babysitting",
        status: "missing",
        humanReviewRequired: true,
      })
    );
  });

  it("becomes eligible when the category human review is verified", () => {
    const authority = evaluateTrustSafetyAuthority({
      facts: facts("verified"),
      policy,
    });

    expect(authority.decision).toBe("eligible");
    expect(authority.reasons).toContain(
      "CATEGORY_POLICY_HUMAN_REVIEW_APPROVED"
    );
  });

  it("keeps a rejected category review explainable and review-bound rather than auto-classifying law", () => {
    const authority = evaluateTrustSafetyAuthority({
      facts: facts("rejected"),
      policy,
    });

    expect(authority.decision).toBe("manual_review");
    expect(authority.legalClassificationAutomatic).toBe(false);
    expect(authority.reasons).toContain(
      "CATEGORY_POLICY_HUMAN_REVIEW_REJECTED"
    );
  });
});
