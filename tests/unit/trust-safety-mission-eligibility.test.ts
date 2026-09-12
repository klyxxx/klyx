import { describe, expect, it } from "vitest";
import {
  evaluateMissionEligibility,
  type CategoryEligibilityPolicy,
  type MissionEligibilityInput,
} from "../../lib/trust-safety/mission-eligibility";

const policy: CategoryEligibilityPolicy = {
  policyId: "policy-be-cleaning-v1",
  version: 1,
  jurisdictionCode: "BE-BRU",
  categoryKey: "cleaning",
  requiredIdentityLevel: "verified",
  requiredVerificationKinds: ["identity"],
  requiredCredentialKinds: [],
  minimumTrustLevel: "verified",
  allowedLegalPathways: [
    "occasional_compatible",
    "employment_structure_required",
    "independent_compatible",
  ],
  requiresHumanReview: false,
};

function eligibleInput(
  overrides: Partial<MissionEligibilityInput> = {}
): MissionEligibilityInput {
  return {
    categoryKey: "cleaning",
    jurisdictionCode: "BE-BRU",
    serviceRef: "service-cleaning",
    bookingRef: "booking-1",
    identityLevel: "verified",
    verifications: [{ kind: "identity", status: "verified" }],
    credentials: [],
    trustLevel: "verified",
    restrictions: [],
    legalAssessment: {
      pathway: "independent_compatible",
      humanReviewRequired: false,
    },
    policy,
    evaluatedAt: new Date("2026-09-12T22:00:00.000Z"),
    ...overrides,
  };
}

describe("KLYX mission eligibility", () => {
  it("allows a mission only when the configured requirements are satisfied", () => {
    const decision = evaluateMissionEligibility(eligibleInput());

    expect(decision.decision).toBe("eligible");
    expect(decision.reasonCodes).toEqual(["ELIGIBLE"]);
    expect(decision.humanReviewRequired).toBe(false);
    expect(decision.policyVersion).toBe(1);
  });

  it("blocks an active scoped restriction and always exposes a review path", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        restrictions: [
          {
            action: "perform_missions",
            scopeType: "category",
            scopeKey: "cleaning",
            status: "active",
            humanReviewRequired: true,
          },
        ],
      })
    );

    expect(decision.decision).toBe("ineligible");
    expect(decision.humanReviewRequired).toBe(true);
    expect(decision.reasonCodes).toContain("ACTIVE_RESTRICTION");
    expect(decision.requiredActions).toContainEqual({
      code: "REQUEST_RESTRICTION_REVIEW",
      detail: "category",
    });
  });

  it("does not let a restriction for another category leak into this mission", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        restrictions: [
          {
            action: "perform_missions",
            scopeType: "category",
            scopeKey: "moving",
            status: "active",
            humanReviewRequired: true,
          },
        ],
      })
    );

    expect(decision.decision).toBe("eligible");
  });

  it("returns requirements_missing when identity is not verified enough", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({ identityLevel: "unverified" })
    );

    expect(decision.decision).toBe("requirements_missing");
    expect(decision.reasonCodes).toEqual(["IDENTITY_REQUIREMENT_MISSING"]);
    expect(decision.requiredActions[0]?.code).toBe("VERIFY_IDENTITY");
  });

  it("treats expired verification evidence as missing", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        verifications: [
          {
            kind: "identity",
            status: "verified",
            expiresAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      })
    );

    expect(decision.decision).toBe("requirements_missing");
    expect(decision.reasonCodes).toEqual([
      "VERIFICATION_REQUIREMENT_MISSING",
    ]);
  });

  it("routes missing regulated-category credentials to completion, not a permanent ban", () => {
    const regulatedPolicy: CategoryEligibilityPolicy = {
      ...policy,
      requiredCredentialKinds: ["regulated_trade_authorisation"],
    };

    const decision = evaluateMissionEligibility(
      eligibleInput({ policy: regulatedPolicy })
    );

    expect(decision.decision).toBe("requirements_missing");
    expect(decision.reasonCodes).toEqual([
      "CREDENTIAL_REQUIREMENT_MISSING",
    ]);
    expect(decision.requiredActions).toContainEqual({
      code: "VERIFY_CREDENTIAL",
      detail: "regulated_trade_authorisation",
    });
  });

  it("requires human review when the legal pathway is unknown instead of guessing a status", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        legalAssessment: {
          pathway: "undetermined",
          humanReviewRequired: true,
          reasonCodes: ["PLATFORM_RELATIONSHIP_REQUIRES_REVIEW"],
        },
      })
    );

    expect(decision.decision).toBe("human_review_required");
    expect(decision.reasonCodes).toEqual(["LEGAL_PATHWAY_UNDETERMINED"]);
    expect(decision.requiredActions[0]?.code).toBe("REQUEST_LEGAL_REVIEW");
  });

  it("requires human review when several delivery frameworks remain plausible", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        legalAssessment: {
          pathway: "multiple_possible",
          humanReviewRequired: true,
        },
      })
    );

    expect(decision.decision).toBe("human_review_required");
    expect(decision.reasonCodes).toEqual(["LEGAL_PATHWAY_UNDETERMINED"]);
  });

  it("requires a verified employment structure when that pathway applies", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        legalAssessment: {
          pathway: "employment_structure_required",
          humanReviewRequired: false,
        },
      })
    );

    expect(decision.decision).toBe("requirements_missing");
    expect(decision.reasonCodes).toEqual([
      "EMPLOYMENT_STRUCTURE_NOT_VERIFIED",
    ]);
    expect(decision.requiredActions[0]?.code).toBe(
      "VERIFY_EMPLOYMENT_STRUCTURE"
    );
  });

  it("accepts the employment path only after the structure is verified", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        verifications: [
          { kind: "identity", status: "verified" },
          { kind: "employment_structure", status: "verified" },
        ],
        legalAssessment: {
          pathway: "employment_structure_required",
          humanReviewRequired: false,
        },
      })
    );

    expect(decision.decision).toBe("eligible");
  });

  it("routes a below-policy trust level to human review rather than an opaque automatic ban", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({ trustLevel: "basic" })
    );

    expect(decision.decision).toBe("human_review_required");
    expect(decision.reasonCodes).toEqual(["TRUST_LEVEL_REVIEW_REQUIRED"]);
    expect(decision.humanReviewRequired).toBe(true);
  });

  it("enforces category policies that mandate manual review", () => {
    const decision = evaluateMissionEligibility(
      eligibleInput({
        policy: {
          ...policy,
          requiresHumanReview: true,
        },
      })
    );

    expect(decision.decision).toBe("human_review_required");
    expect(decision.reasonCodes).toEqual([
      "CATEGORY_POLICY_REQUIRES_HUMAN_REVIEW",
    ]);
  });

  it("rejects a mismatched policy scope instead of silently using the wrong rule set", () => {
    expect(() =>
      evaluateMissionEligibility(
        eligibleInput({
          policy: {
            ...policy,
            categoryKey: "babysitting",
          },
        })
      )
    ).toThrow("KLYX_TRUST_POLICY_SCOPE_MISMATCH");
  });
});
