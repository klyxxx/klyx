export const PROVIDER_LEGAL_RULESET_VERSION = "be-provider-legal-v1" as const;

export const PROVIDER_LEGAL_PATHS = [
  "unknown",
  "occasional",
  "employee_compatible",
  "professional_independent",
] as const;

export type ProviderLegalPath = (typeof PROVIDER_LEGAL_PATHS)[number];

export const PROVIDER_LEGAL_ELIGIBILITY = [
  "unknown",
  "conditionally_eligible",
  "eligible",
  "ineligible",
] as const;

export type ProviderLegalEligibility =
  (typeof PROVIDER_LEGAL_ELIGIBILITY)[number];

export const PROVIDER_STUDENT_CONTEXTS = ["unknown", "no", "yes"] as const;
export type ProviderStudentContext =
  (typeof PROVIDER_STUDENT_CONTEXTS)[number];

export const PROVIDER_ACTIVITY_FREQUENCIES = [
  "unknown",
  "one_off",
  "intermittent",
  "recurring",
] as const;
export type ProviderActivityFrequency =
  (typeof PROVIDER_ACTIVITY_FREQUENCIES)[number];

export const PROVIDER_SELF_EMPLOYMENT_CAPACITIES = [
  "unknown",
  "main",
  "complementary",
  "student_independent",
  "other",
] as const;
export type ProviderSelfEmploymentCapacity =
  (typeof PROVIDER_SELF_EMPLOYMENT_CAPACITIES)[number];

export const PROVIDER_DECLARATION_STATES = ["unknown", "no", "yes"] as const;
export type ProviderDeclarationState =
  (typeof PROVIDER_DECLARATION_STATES)[number];

export const PROVIDER_VERIFICATION_STATES = [
  "unknown",
  "pending",
  "verified",
  "rejected",
] as const;
export type ProviderVerificationState =
  (typeof PROVIDER_VERIFICATION_STATES)[number];

export const PROVIDER_HUMAN_REVIEW_STATES = [
  "not_reviewed",
  "pending",
  "approved",
  "rejected",
] as const;
export type ProviderHumanReviewState =
  (typeof PROVIDER_HUMAN_REVIEW_STATES)[number];

export type ProviderLegalDeclarations = {
  path: ProviderLegalPath;
  studentContext: ProviderStudentContext;
  activityFrequency: ProviderActivityFrequency;
  selfEmploymentCapacity: ProviderSelfEmploymentCapacity;
  enterpriseNumber: string | null;
  socialInsuranceFundAffiliation: ProviderDeclarationState;
};

export type ProviderLegalVerification = {
  enterpriseRegistration: ProviderVerificationState;
  socialInsuranceFund: ProviderVerificationState;
  employmentArrangement: ProviderVerificationState;
  humanReview: ProviderHumanReviewState;
  reviewedPath: ProviderLegalPath | null;
};

export type ProviderLegalAuthorityInput = {
  jurisdictionCountryCode: string | null;
  declarations: ProviderLegalDeclarations;
  verification: ProviderLegalVerification;
};

export type ProviderLegalAssessment = {
  path: ProviderLegalPath;
  eligibility: ProviderLegalEligibility;
  missingData: string[];
  reasons: string[];
  humanReviewRequired: boolean;
  humanReviewStatus: ProviderHumanReviewState;
  rulesetVersion: typeof PROVIDER_LEGAL_RULESET_VERSION;
};

export type ProviderLegalAuthority = {
  source: "klyx_provider_legal_authority";
  jurisdictionCountryCode: string | null;
  declarations: ProviderLegalDeclarations;
  verification: ProviderLegalVerification;
  assessment: ProviderLegalAssessment;
};

export const DEFAULT_PROVIDER_LEGAL_DECLARATIONS: ProviderLegalDeclarations = {
  path: "unknown",
  studentContext: "unknown",
  activityFrequency: "unknown",
  selfEmploymentCapacity: "unknown",
  enterpriseNumber: null,
  socialInsuranceFundAffiliation: "unknown",
};

export const DEFAULT_PROVIDER_LEGAL_VERIFICATION: ProviderLegalVerification = {
  enterpriseRegistration: "unknown",
  socialInsuranceFund: "unknown",
  employmentArrangement: "unknown",
  humanReview: "not_reviewed",
  reviewedPath: null,
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * KLYX_PROVIDER_LEGAL_AUTHORITY_BE_20260912
 *
 * This evaluator deliberately produces an operational KLYX path, not a legal
 * determination of employment status. Belgian worker classification is
 * fact-sensitive and platform work has its own statutory presumption criteria.
 * A provider declaration therefore never becomes an irreversible legal status.
 */
export function evaluateProviderLegalAuthority(
  input: ProviderLegalAuthorityInput
): ProviderLegalAssessment {
  const missingData: string[] = [];
  const reasons: string[] = ["LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC"];
  const countryCode = input.jurisdictionCountryCode?.trim().toUpperCase() ?? null;
  const path = input.declarations.path;
  const humanReview = input.verification.humanReview;

  if (!countryCode) {
    missingData.push("jurisdiction_country_code");
    reasons.push("JURISDICTION_MISSING");
  } else if (countryCode !== "BE") {
    reasons.push("BELGIAN_RULESET_NOT_APPLICABLE");
    return {
      path: "unknown",
      eligibility: "unknown",
      missingData,
      reasons: unique(reasons),
      humanReviewRequired: true,
      humanReviewStatus: humanReview,
      rulesetVersion: PROVIDER_LEGAL_RULESET_VERSION,
    };
  } else {
    reasons.push("BELGIAN_RULESET_APPLIED");
    reasons.push("PLATFORM_WORK_CLASSIFICATION_REQUIRES_FACTUAL_REVIEW");
  }

  if (path === "unknown") {
    missingData.push("declared_path");
    reasons.push("PROVIDER_PATH_NOT_DECLARED");
  }

  if (input.declarations.studentContext === "yes") {
    reasons.push("STUDENT_IS_CONTEXT_NOT_LEGAL_PATH");
  }

  if (humanReview === "rejected") {
    reasons.push("HUMAN_REVIEW_REJECTED");
    return {
      path,
      eligibility: "ineligible",
      missingData: unique(missingData),
      reasons: unique(reasons),
      humanReviewRequired: false,
      humanReviewStatus: humanReview,
      rulesetVersion: PROVIDER_LEGAL_RULESET_VERSION,
    };
  }

  if (path === "unknown" || !countryCode) {
    return {
      path,
      eligibility: "unknown",
      missingData: unique(missingData),
      reasons: unique(reasons),
      humanReviewRequired: true,
      humanReviewStatus: humanReview,
      rulesetVersion: PROVIDER_LEGAL_RULESET_VERSION,
    };
  }

  if (path === "occasional") {
    if (input.declarations.activityFrequency === "unknown") {
      missingData.push("activity_frequency");
    }
    if (input.declarations.activityFrequency === "recurring") {
      reasons.push("OCCASIONAL_PATH_CONFLICTS_WITH_RECURRING_ACTIVITY");
    }
    reasons.push("OCCASIONAL_PATH_IS_NOT_AUTOMATIC_LEGAL_EXEMPTION");
  }

  if (path === "employee_compatible") {
    reasons.push("EMPLOYEE_COMPATIBLE_IS_OPERATIONAL_PATH_NOT_EMPLOYEE_STATUS");
    if (input.verification.employmentArrangement !== "verified") {
      missingData.push("verified_employment_arrangement");
      reasons.push("EMPLOYMENT_ARRANGEMENT_NOT_VERIFIED");
    }
  }

  if (path === "professional_independent") {
    reasons.push(
      "PROFESSIONAL_INDEPENDENT_PATH_DOES_NOT_OVERRIDE_WORKER_CLASSIFICATION"
    );

    if (input.declarations.selfEmploymentCapacity === "unknown") {
      missingData.push("self_employment_capacity");
    }
    if (!input.declarations.enterpriseNumber) {
      missingData.push("enterprise_number");
    }
    if (input.declarations.socialInsuranceFundAffiliation !== "yes") {
      missingData.push("social_insurance_fund_affiliation");
    }
    if (input.verification.enterpriseRegistration !== "verified") {
      missingData.push("verified_enterprise_registration");
    }
    if (input.verification.socialInsuranceFund !== "verified") {
      missingData.push("verified_social_insurance_fund");
    }
  }

  const reviewMatchesPath = input.verification.reviewedPath === path;
  const reviewApproved = humanReview === "approved" && reviewMatchesPath;

  if (humanReview === "approved" && !reviewMatchesPath) {
    reasons.push("HUMAN_REVIEW_DOES_NOT_MATCH_CURRENT_PATH");
  }

  if (!reviewApproved) {
    reasons.push("HUMAN_REVIEW_REQUIRED");
  } else {
    reasons.push("HUMAN_REVIEW_APPROVED_FOR_CURRENT_PATH");
  }

  if (missingData.length > 0) {
    return {
      path,
      eligibility: "conditionally_eligible",
      missingData: unique(missingData),
      reasons: unique(reasons),
      humanReviewRequired: true,
      humanReviewStatus: humanReview,
      rulesetVersion: PROVIDER_LEGAL_RULESET_VERSION,
    };
  }

  return {
    path,
    eligibility: reviewApproved ? "eligible" : "conditionally_eligible",
    missingData: [],
    reasons: unique(reasons),
    humanReviewRequired: !reviewApproved,
    humanReviewStatus: humanReview,
    rulesetVersion: PROVIDER_LEGAL_RULESET_VERSION,
  };
}

export function buildProviderLegalAuthority(
  input: ProviderLegalAuthorityInput
): ProviderLegalAuthority {
  return {
    source: "klyx_provider_legal_authority",
    jurisdictionCountryCode:
      input.jurisdictionCountryCode?.trim().toUpperCase() ?? null,
    declarations: input.declarations,
    verification: input.verification,
    assessment: evaluateProviderLegalAuthority(input),
  };
}
