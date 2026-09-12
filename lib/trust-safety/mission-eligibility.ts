export type IdentityLevel = "unverified" | "verified" | "enhanced";

export type TrustLevel = "unassessed" | "basic" | "verified" | "enhanced";

export type LegalPathway =
  | "undetermined"
  | "occasional_compatible"
  | "employment_structure_required"
  | "independent_compatible"
  | "multiple_possible";

export type MissionEligibilityDecision =
  | "eligible"
  | "eligible_with_conditions"
  | "requirements_missing"
  | "human_review_required"
  | "ineligible";

export type VerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "expired"
  | "revoked";

export type RestrictionScopeType =
  | "platform"
  | "category"
  | "service"
  | "booking";

export type RestrictedAction =
  | "perform_missions"
  | "accept_bookings"
  | "receive_payouts"
  | "contact_users"
  | "use_platform";

export type DecisionReasonCode =
  | "ACTIVE_RESTRICTION"
  | "IDENTITY_REQUIREMENT_MISSING"
  | "VERIFICATION_REQUIREMENT_MISSING"
  | "CREDENTIAL_REQUIREMENT_MISSING"
  | "TRUST_ASSESSMENT_MISSING"
  | "TRUST_LEVEL_REVIEW_REQUIRED"
  | "LEGAL_PATHWAY_UNDETERMINED"
  | "LEGAL_PATHWAY_REVIEW_REQUIRED"
  | "LEGAL_PATHWAY_NOT_ALLOWED_BY_POLICY"
  | "EMPLOYMENT_STRUCTURE_NOT_VERIFIED"
  | "CATEGORY_POLICY_REQUIRES_HUMAN_REVIEW"
  | "ELIGIBLE";

export type RequiredActionCode =
  | "REQUEST_RESTRICTION_REVIEW"
  | "VERIFY_IDENTITY"
  | "COMPLETE_VERIFICATION"
  | "VERIFY_CREDENTIAL"
  | "COMPLETE_TRUST_ASSESSMENT"
  | "REQUEST_TRUST_REVIEW"
  | "REQUEST_LEGAL_REVIEW"
  | "VERIFY_EMPLOYMENT_STRUCTURE"
  | "COMPLETE_CATEGORY_REVIEW";

export type RequiredAction = {
  code: RequiredActionCode;
  detail?: string;
};

export type VerificationInput = {
  kind: string;
  status: VerificationStatus;
  scopeKey?: string | null;
  expiresAt?: string | null;
};

export type CredentialInput = {
  kind: string;
  status: VerificationStatus;
  categoryKey?: string | null;
  jurisdictionCode?: string | null;
  expiresAt?: string | null;
};

export type RestrictionInput = {
  action: RestrictedAction;
  scopeType: RestrictionScopeType;
  scopeKey?: string | null;
  status: "active" | "revoked" | "expired";
  humanReviewRequired: boolean;
};

export type LegalAssessmentInput = {
  pathway: LegalPathway;
  humanReviewRequired: boolean;
  reasonCodes?: string[];
};

export type CategoryEligibilityPolicy = {
  policyId: string;
  version: number;
  jurisdictionCode: string;
  categoryKey: string;
  requiredIdentityLevel: IdentityLevel;
  requiredVerificationKinds: string[];
  requiredCredentialKinds: string[];
  minimumTrustLevel: TrustLevel;
  allowedLegalPathways: Exclude<LegalPathway, "undetermined" | "multiple_possible">[];
  requiresHumanReview: boolean;
};

export type MissionEligibilityInput = {
  categoryKey: string;
  jurisdictionCode: string;
  serviceRef?: string | null;
  bookingRef?: string | null;
  identityLevel: IdentityLevel;
  verifications: VerificationInput[];
  credentials: CredentialInput[];
  trustLevel: TrustLevel;
  restrictions: RestrictionInput[];
  legalAssessment: LegalAssessmentInput;
  policy: CategoryEligibilityPolicy;
  evaluatedAt?: Date;
};

export type MissionEligibilityResult = {
  decision: MissionEligibilityDecision;
  legalPathway: LegalPathway;
  humanReviewRequired: boolean;
  reasonCodes: DecisionReasonCode[];
  requiredActions: RequiredAction[];
  explanation: string;
  policyId: string;
  policyVersion: number;
};

const IDENTITY_LEVEL_RANK: Record<IdentityLevel, number> = {
  unverified: 0,
  verified: 1,
  enhanced: 2,
};

const TRUST_LEVEL_RANK: Record<TrustLevel, number> = {
  unassessed: 0,
  basic: 1,
  verified: 2,
  enhanced: 3,
};

function isCurrentVerified(
  item: { status: VerificationStatus; expiresAt?: string | null },
  now: Date
) {
  if (item.status !== "verified") {
    return false;
  }

  if (!item.expiresAt) {
    return true;
  }

  const expiresAt = new Date(item.expiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

function restrictionApplies(
  restriction: RestrictionInput,
  input: MissionEligibilityInput
) {
  if (restriction.status !== "active") {
    return false;
  }

  if (
    restriction.action !== "perform_missions" &&
    restriction.action !== "accept_bookings" &&
    restriction.action !== "use_platform"
  ) {
    return false;
  }

  switch (restriction.scopeType) {
    case "platform":
      return true;
    case "category":
      return restriction.scopeKey === input.categoryKey;
    case "service":
      return Boolean(input.serviceRef) && restriction.scopeKey === input.serviceRef;
    case "booking":
      return Boolean(input.bookingRef) && restriction.scopeKey === input.bookingRef;
  }
}

function result(
  input: MissionEligibilityInput,
  decision: MissionEligibilityDecision,
  humanReviewRequired: boolean,
  reasonCodes: DecisionReasonCode[],
  requiredActions: RequiredAction[],
  explanation: string
): MissionEligibilityResult {
  return {
    decision,
    legalPathway: input.legalAssessment.pathway,
    humanReviewRequired,
    reasonCodes,
    requiredActions,
    explanation,
    policyId: input.policy.policyId,
    policyVersion: input.policy.version,
  };
}

/**
 * Deterministic mission-eligibility gate.
 *
 * This function deliberately does not infer Belgian employment or
 * self-employment status from declarations, enterprise registration,
 * frequency, pricing, or any other single fact. The legal pathway is supplied
 * as a separate operational assessment and ambiguous cases are routed to human
 * review.
 */
export function evaluateMissionEligibility(
  input: MissionEligibilityInput
): MissionEligibilityResult {
  const now = input.evaluatedAt ?? new Date();

  if (
    input.policy.categoryKey !== input.categoryKey ||
    input.policy.jurisdictionCode !== input.jurisdictionCode
  ) {
    throw new Error("KLYX_TRUST_POLICY_SCOPE_MISMATCH");
  }

  const activeRestriction = input.restrictions.find((restriction) =>
    restrictionApplies(restriction, input)
  );

  if (activeRestriction) {
    return result(
      input,
      "ineligible",
      true,
      ["ACTIVE_RESTRICTION"],
      [
        {
          code: "REQUEST_RESTRICTION_REVIEW",
          detail: activeRestriction.scopeType,
        },
      ],
      "A current Trust & Safety restriction blocks this mission. The restriction has a recorded reason and can be reviewed through the case workflow."
    );
  }

  if (
    IDENTITY_LEVEL_RANK[input.identityLevel] <
    IDENTITY_LEVEL_RANK[input.policy.requiredIdentityLevel]
  ) {
    return result(
      input,
      "requirements_missing",
      false,
      ["IDENTITY_REQUIREMENT_MISSING"],
      [{ code: "VERIFY_IDENTITY", detail: input.policy.requiredIdentityLevel }],
      "The identity verification level required by this category policy has not been met yet."
    );
  }

  const missingVerificationKinds = input.policy.requiredVerificationKinds.filter(
    (requiredKind) =>
      !input.verifications.some(
        (verification) =>
          verification.kind === requiredKind &&
          isCurrentVerified(verification, now)
      )
  );

  if (missingVerificationKinds.length > 0) {
    return result(
      input,
      "requirements_missing",
      false,
      ["VERIFICATION_REQUIREMENT_MISSING"],
      missingVerificationKinds.map((kind) => ({
        code: "COMPLETE_VERIFICATION" as const,
        detail: kind,
      })),
      "One or more verifications required for this category are missing, expired, rejected or revoked."
    );
  }

  const missingCredentialKinds = input.policy.requiredCredentialKinds.filter(
    (requiredKind) =>
      !input.credentials.some(
        (credential) =>
          credential.kind === requiredKind &&
          (!credential.categoryKey || credential.categoryKey === input.categoryKey) &&
          (!credential.jurisdictionCode ||
            credential.jurisdictionCode === input.jurisdictionCode) &&
          isCurrentVerified(credential, now)
      )
  );

  if (missingCredentialKinds.length > 0) {
    return result(
      input,
      "requirements_missing",
      false,
      ["CREDENTIAL_REQUIREMENT_MISSING"],
      missingCredentialKinds.map((kind) => ({
        code: "VERIFY_CREDENTIAL" as const,
        detail: kind,
      })),
      "A qualification, licence or competency requirement for this category has not been verified."
    );
  }

  if (input.trustLevel === "unassessed") {
    return result(
      input,
      "requirements_missing",
      false,
      ["TRUST_ASSESSMENT_MISSING"],
      [{ code: "COMPLETE_TRUST_ASSESSMENT" }],
      "A current explainable trust assessment is required before this mission can proceed."
    );
  }

  if (
    TRUST_LEVEL_RANK[input.trustLevel] <
    TRUST_LEVEL_RANK[input.policy.minimumTrustLevel]
  ) {
    return result(
      input,
      "human_review_required",
      true,
      ["TRUST_LEVEL_REVIEW_REQUIRED"],
      [{ code: "REQUEST_TRUST_REVIEW" }],
      "The current trust level does not meet this category policy. A human review is required before a final adverse decision."
    );
  }

  if (
    input.legalAssessment.pathway === "undetermined" ||
    input.legalAssessment.pathway === "multiple_possible"
  ) {
    return result(
      input,
      "human_review_required",
      true,
      ["LEGAL_PATHWAY_UNDETERMINED"],
      [{ code: "REQUEST_LEGAL_REVIEW" }],
      "The applicable delivery framework is not sufficiently determined for this mission and must be reviewed."
    );
  }

  if (input.legalAssessment.humanReviewRequired) {
    return result(
      input,
      "human_review_required",
      true,
      ["LEGAL_PATHWAY_REVIEW_REQUIRED"],
      [{ code: "REQUEST_LEGAL_REVIEW" }],
      "The operational legal-pathway assessment requires human review before this mission can proceed."
    );
  }

  if (
    !input.policy.allowedLegalPathways.includes(input.legalAssessment.pathway)
  ) {
    return result(
      input,
      "human_review_required",
      true,
      ["LEGAL_PATHWAY_NOT_ALLOWED_BY_POLICY"],
      [{ code: "REQUEST_LEGAL_REVIEW" }],
      "The assessed delivery framework is not enabled by the current category policy. A reviewer must determine the next lawful path."
    );
  }

  if (input.legalAssessment.pathway === "employment_structure_required") {
    const employmentStructureVerified = input.verifications.some(
      (verification) =>
        verification.kind === "employment_structure" &&
        isCurrentVerified(verification, now)
    );

    if (!employmentStructureVerified) {
      return result(
        input,
        "requirements_missing",
        false,
        ["EMPLOYMENT_STRUCTURE_NOT_VERIFIED"],
        [{ code: "VERIFY_EMPLOYMENT_STRUCTURE" }],
        "This mission requires a compatible employment structure, but no current structure verification is recorded."
      );
    }
  }

  if (input.policy.requiresHumanReview) {
    return result(
      input,
      "human_review_required",
      true,
      ["CATEGORY_POLICY_REQUIRES_HUMAN_REVIEW"],
      [{ code: "COMPLETE_CATEGORY_REVIEW" }],
      "This category is configured for mandatory human review before mission performance."
    );
  }

  return result(
    input,
    "eligible",
    false,
    ["ELIGIBLE"],
    [],
    "The current identity, verification, qualification, trust, restriction and delivery-framework requirements are satisfied for this policy version."
  );
}
