export const TRUST_SAFETY_RULESET_VERSION = "klyx-trust-safety-v1" as const;

export const TRUST_SAFETY_LEGAL_PATHS = [
  "unknown",
  "occasional_compatible",
  "employment_via_structure",
  "professional_independent",
] as const;
export type TrustSafetyLegalPath =
  (typeof TRUST_SAFETY_LEGAL_PATHS)[number];

export const TRUST_SAFETY_ACTIVITY_FREQUENCIES = [
  "unknown",
  "one_off",
  "intermittent",
  "recurring",
] as const;
export type TrustSafetyActivityFrequency =
  (typeof TRUST_SAFETY_ACTIVITY_FREQUENCIES)[number];

export const TRUST_SAFETY_VERIFICATION_STATES = [
  "unknown",
  "pending",
  "verified",
  "rejected",
] as const;
export type TrustSafetyVerificationState =
  (typeof TRUST_SAFETY_VERIFICATION_STATES)[number];

export const TRUST_SAFETY_REVIEW_STATES = [
  "not_reviewed",
  "pending",
  "approved",
  "rejected",
] as const;
export type TrustSafetyReviewState =
  (typeof TRUST_SAFETY_REVIEW_STATES)[number];

export const TRUST_SAFETY_IDENTITY_LEVELS = [
  "unknown",
  "basic",
  "verified",
] as const;
export type TrustSafetyIdentityLevel =
  (typeof TRUST_SAFETY_IDENTITY_LEVELS)[number];

export const TRUST_SAFETY_TRUST_LEVELS = [
  "unknown",
  "limited",
  "standard",
  "strong",
  "restricted",
] as const;
export type TrustSafetyTrustLevel =
  (typeof TRUST_SAFETY_TRUST_LEVELS)[number];

export const TRUST_SAFETY_DECISIONS = [
  "eligible",
  "conditional",
  "manual_review",
  "blocked",
] as const;
export type TrustSafetyDecision =
  (typeof TRUST_SAFETY_DECISIONS)[number];

export type TrustSafetyRequirementKind =
  | "identity"
  | "qualification"
  | "verification"
  | "trust"
  | "category_restriction"
  | "legal_path"
  | "human_review";

export type TrustSafetyRequirementStatus =
  | "satisfied"
  | "missing"
  | "pending"
  | "rejected"
  | "blocked";

export type TrustSafetyRequirement = {
  kind: TrustSafetyRequirementKind;
  key: string;
  status: TrustSafetyRequirementStatus;
  reasonCode: string;
  humanReviewRequired: boolean;
};

export type TrustSafetyRestriction = {
  id: string;
  scope: "global" | "category";
  categoryKey: string | null;
  action: "manual_review_only" | "category_block" | "mission_block";
  status: "active" | "under_review" | "lifted" | "expired";
  reasonCode: string;
  explanation: string;
  endsAt: string | null;
  reviewStatus: "not_requested" | "pending" | "upheld" | "modified" | "lifted";
};

export type TrustSafetyCategoryPolicy = {
  jurisdictionCountryCode: string;
  categoryKey: string;
  riskTier: "standard" | "elevated" | "sensitive";
  requiredIdentityLevel: TrustSafetyIdentityLevel;
  minimumTrustLevel: Exclude<TrustSafetyTrustLevel, "restricted">;
  requiredQualifications: string[];
  requiredVerifications: string[];
  allowedLegalPaths: TrustSafetyLegalPath[];
  humanReviewMode: "never" | "if_sensitive" | "always";
};

export type TrustSafetyFacts = {
  jurisdictionCountryCode: string | null;
  identityLevel: TrustSafetyIdentityLevel;
  trustLevel: TrustSafetyTrustLevel;
  declaredLegalPath: TrustSafetyLegalPath;
  activityFrequency: TrustSafetyActivityFrequency;
  legalPathReview: TrustSafetyReviewState;
  reviewedLegalPath: TrustSafetyLegalPath | null;
  qualifications: Record<string, TrustSafetyVerificationState>;
  verifications: Record<string, TrustSafetyVerificationState>;
  restrictions: TrustSafetyRestriction[];
  unresolvedSafetyReports: number;
  unresolvedFraudReports: number;
  unresolvedNoShows: number;
  unresolvedDisputes: number;
};

export type TrustSafetyAuthority = {
  source: "klyx_trust_safety_authority";
  rulesetVersion: typeof TRUST_SAFETY_RULESET_VERSION;
  categoryKey: string;
  jurisdictionCountryCode: string | null;
  decision: TrustSafetyDecision;
  requirements: TrustSafetyRequirement[];
  reasons: string[];
  humanReviewRequired: boolean;
  sensitiveDecision: boolean;
  reversible: true;
  legalClassificationAutomatic: false;
};

const IDENTITY_RANK: Record<TrustSafetyIdentityLevel, number> = {
  unknown: 0,
  basic: 1,
  verified: 2,
};

const TRUST_RANK: Record<TrustSafetyTrustLevel, number> = {
  unknown: 0,
  limited: 1,
  standard: 2,
  strong: 3,
  restricted: -1,
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function requirementStatus(
  state: TrustSafetyVerificationState
): TrustSafetyRequirementStatus {
  if (state === "verified") return "satisfied";
  if (state === "pending") return "pending";
  if (state === "rejected") return "rejected";
  return "missing";
}

function activeForCategory(
  restriction: TrustSafetyRestriction,
  categoryKey: string
): boolean {
  if (
    restriction.status !== "active" &&
    restriction.status !== "under_review"
  ) {
    return false;
  }
  if (restriction.endsAt && Date.parse(restriction.endsAt) <= Date.now()) {
    return false;
  }
  return (
    restriction.scope === "global" ||
    restriction.categoryKey === categoryKey
  );
}

/**
 * Role-independent mission readiness authority.
 *
 * This is an operational KLYX decision, not a legal determination of employee,
 * independent-professional or occasional-work status. Sensitive conclusions
 * remain explainable, auditable and human-reviewable.
 */
export function evaluateTrustSafetyAuthority(input: {
  facts: TrustSafetyFacts;
  policy: TrustSafetyCategoryPolicy;
}): TrustSafetyAuthority {
  const { facts, policy } = input;
  const requirements: TrustSafetyRequirement[] = [];
  const reasons: string[] = [
    "LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC",
    "SENSITIVE_DECISIONS_ARE_EXPLAINABLE_AND_REVIEWABLE",
  ];
  let hardBlocked = false;
  let manualReview = false;
  let conditional = false;

  const countryCode =
    facts.jurisdictionCountryCode?.trim().toUpperCase() ?? null;

  if (
    !countryCode ||
    countryCode !== policy.jurisdictionCountryCode.toUpperCase()
  ) {
    requirements.push({
      kind: "human_review",
      key: "jurisdiction",
      status: "pending",
      reasonCode: "POLICY_JURISDICTION_MISMATCH",
      humanReviewRequired: true,
    });
    reasons.push("POLICY_JURISDICTION_MISMATCH");
    manualReview = true;
  }

  if (
    IDENTITY_RANK[facts.identityLevel] <
    IDENTITY_RANK[policy.requiredIdentityLevel]
  ) {
    requirements.push({
      kind: "identity",
      key: policy.requiredIdentityLevel,
      status: facts.identityLevel === "unknown" ? "missing" : "pending",
      reasonCode: "IDENTITY_LEVEL_INSUFFICIENT",
      humanReviewRequired: false,
    });
    reasons.push("IDENTITY_LEVEL_INSUFFICIENT");
    conditional = true;
  } else {
    requirements.push({
      kind: "identity",
      key: policy.requiredIdentityLevel,
      status: "satisfied",
      reasonCode: "IDENTITY_LEVEL_SATISFIED",
      humanReviewRequired: false,
    });
  }

  if (facts.trustLevel === "restricted") {
    requirements.push({
      kind: "trust",
      key: "trust_level",
      status: "pending",
      reasonCode: "TRUST_LEVEL_REQUIRES_REVIEW",
      humanReviewRequired: true,
    });
    reasons.push("TRUST_LEVEL_REQUIRES_REVIEW");
    manualReview = true;
  } else if (
    TRUST_RANK[facts.trustLevel] < TRUST_RANK[policy.minimumTrustLevel]
  ) {
    requirements.push({
      kind: "trust",
      key: policy.minimumTrustLevel,
      status: "missing",
      reasonCode: "TRUST_LEVEL_BELOW_POLICY",
      humanReviewRequired: false,
    });
    reasons.push("TRUST_LEVEL_BELOW_POLICY");
    conditional = true;
  } else {
    requirements.push({
      kind: "trust",
      key: policy.minimumTrustLevel,
      status: "satisfied",
      reasonCode: "TRUST_LEVEL_SATISFIED",
      humanReviewRequired: false,
    });
  }

  for (const qualification of policy.requiredQualifications) {
    const state = facts.qualifications[qualification] ?? "unknown";
    const status = requirementStatus(state);
    requirements.push({
      kind: "qualification",
      key: qualification,
      status,
      reasonCode: `QUALIFICATION_${status.toUpperCase()}`,
      humanReviewRequired: status === "rejected",
    });
    if (status === "rejected") manualReview = true;
    else if (status !== "satisfied") conditional = true;
  }

  for (const verification of policy.requiredVerifications) {
    const state = facts.verifications[verification] ?? "unknown";
    const status = requirementStatus(state);
    requirements.push({
      kind: "verification",
      key: verification,
      status,
      reasonCode: `VERIFICATION_${status.toUpperCase()}`,
      humanReviewRequired: status === "rejected",
    });
    if (status === "rejected") manualReview = true;
    else if (status !== "satisfied") conditional = true;
  }

  if (facts.declaredLegalPath === "unknown") {
    requirements.push({
      kind: "legal_path",
      key: "declared_legal_path",
      status: "missing",
      reasonCode: "LEGAL_PATH_NOT_DECLARED",
      humanReviewRequired: true,
    });
    reasons.push("LEGAL_PATH_NOT_DECLARED");
    manualReview = true;
  } else {
    const allowed = policy.allowedLegalPaths.includes(
      facts.declaredLegalPath
    );
    requirements.push({
      kind: "legal_path",
      key: facts.declaredLegalPath,
      status: allowed ? "satisfied" : "pending",
      reasonCode: allowed
        ? "LEGAL_PATH_POLICY_COMPATIBLE"
        : "LEGAL_PATH_POLICY_REVIEW_REQUIRED",
      humanReviewRequired: !allowed,
    });
    if (!allowed) {
      reasons.push("LEGAL_PATH_POLICY_REVIEW_REQUIRED");
      manualReview = true;
    }

    if (
      facts.declaredLegalPath === "occasional_compatible" &&
      facts.activityFrequency === "recurring"
    ) {
      reasons.push(
        "OCCASIONAL_PATH_CONFLICTS_WITH_RECURRING_ACTIVITY"
      );
      manualReview = true;
    }

    if (facts.declaredLegalPath === "employment_via_structure") {
      const state =
        facts.verifications.employment_arrangement ?? "unknown";
      const status = requirementStatus(state);
      requirements.push({
        kind: "verification",
        key: "employment_arrangement",
        status,
        reasonCode: `EMPLOYMENT_ARRANGEMENT_${status.toUpperCase()}`,
        humanReviewRequired: status === "rejected",
      });
      if (status === "rejected") manualReview = true;
      else if (status !== "satisfied") conditional = true;
    }

    if (facts.declaredLegalPath === "professional_independent") {
      for (const key of [
        "enterprise_registration",
        "social_insurance_fund",
      ]) {
        const state = facts.verifications[key] ?? "unknown";
        const status = requirementStatus(state);
        requirements.push({
          kind: "verification",
          key,
          status,
          reasonCode: `${key.toUpperCase()}_${status.toUpperCase()}`,
          humanReviewRequired: status === "rejected",
        });
        if (status === "rejected") manualReview = true;
        else if (status !== "satisfied") conditional = true;
      }
    }

    const reviewMatches =
      facts.reviewedLegalPath === facts.declaredLegalPath;
    const reviewApproved =
      facts.legalPathReview === "approved" && reviewMatches;
    requirements.push({
      kind: "human_review",
      key: "legal_path_review",
      status: reviewApproved
        ? "satisfied"
        : facts.legalPathReview === "rejected"
          ? "rejected"
          : "pending",
      reasonCode: reviewApproved
        ? "LEGAL_PATH_HUMAN_REVIEW_APPROVED"
        : "LEGAL_PATH_HUMAN_REVIEW_REQUIRED",
      humanReviewRequired: !reviewApproved,
    });
    if (!reviewApproved) manualReview = true;
  }

  const relevantRestrictions = facts.restrictions.filter((restriction) =>
    activeForCategory(restriction, policy.categoryKey)
  );
  for (const restriction of relevantRestrictions) {
    const blocks =
      restriction.action === "category_block" ||
      restriction.action === "mission_block";
    requirements.push({
      kind: "category_restriction",
      key: restriction.id,
      status: blocks ? "blocked" : "pending",
      reasonCode: restriction.reasonCode,
      humanReviewRequired: true,
    });
    reasons.push(restriction.reasonCode);
    if (blocks) hardBlocked = true;
    else manualReview = true;
  }

  if (facts.unresolvedSafetyReports > 0) {
    reasons.push("UNRESOLVED_SAFETY_REPORT_REQUIRES_REVIEW");
    manualReview = true;
  }
  if (facts.unresolvedFraudReports > 0) {
    reasons.push("UNRESOLVED_FRAUD_REPORT_REQUIRES_REVIEW");
    manualReview = true;
  }
  if (facts.unresolvedNoShows > 0) {
    reasons.push("NO_SHOW_HISTORY_IS_SIGNAL_NOT_AUTOMATIC_PENALTY");
  }
  if (facts.unresolvedDisputes > 0) {
    reasons.push("DISPUTE_HISTORY_IS_SIGNAL_NOT_AUTOMATIC_PENALTY");
  }

  const categoryReviewRequired =
    policy.humanReviewMode === "always" ||
    (policy.humanReviewMode === "if_sensitive" &&
      policy.riskTier === "sensitive");

  if (categoryReviewRequired) {
    // Category review is represented as a normal server-controlled verification
    // so the state can be approved/rejected by an admin and later re-evaluated.
    const categoryReviewKey = `category_review:${policy.categoryKey}`;
    const state = facts.verifications[categoryReviewKey] ?? "unknown";
    const status = requirementStatus(state);
    requirements.push({
      kind: "human_review",
      key: categoryReviewKey,
      status,
      reasonCode:
        status === "satisfied"
          ? "CATEGORY_POLICY_HUMAN_REVIEW_APPROVED"
          : status === "rejected"
            ? "CATEGORY_POLICY_HUMAN_REVIEW_REJECTED"
            : "CATEGORY_POLICY_REQUIRES_HUMAN_REVIEW",
      humanReviewRequired: status !== "satisfied",
    });

    if (status === "satisfied") {
      reasons.push("CATEGORY_POLICY_HUMAN_REVIEW_APPROVED");
    } else {
      reasons.push(
        status === "rejected"
          ? "CATEGORY_POLICY_HUMAN_REVIEW_REJECTED"
          : "CATEGORY_POLICY_REQUIRES_HUMAN_REVIEW"
      );
      manualReview = true;
    }
  }

  const decision: TrustSafetyDecision = hardBlocked
    ? "blocked"
    : manualReview
      ? "manual_review"
      : conditional
        ? "conditional"
        : "eligible";

  return {
    source: "klyx_trust_safety_authority",
    rulesetVersion: TRUST_SAFETY_RULESET_VERSION,
    categoryKey: policy.categoryKey,
    jurisdictionCountryCode: countryCode,
    decision,
    requirements,
    reasons: unique(reasons),
    humanReviewRequired: manualReview || hardBlocked,
    sensitiveDecision:
      decision === "manual_review" || decision === "blocked",
    reversible: true,
    legalClassificationAutomatic: false,
  };
}
