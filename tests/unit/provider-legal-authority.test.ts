import { describe, expect, it } from "vitest";

import {
  buildProviderLegalAuthority,
  DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
  DEFAULT_PROVIDER_LEGAL_VERIFICATION,
  evaluateProviderLegalAuthority,
} from "@/lib/provider-legal-authority";

describe("provider legal authority — Belgium", () => {
  it("never treats student context as a legal path", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "BE",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        studentContext: "yes",
      },
      verification: DEFAULT_PROVIDER_LEGAL_VERIFICATION,
    });

    expect(assessment.path).toBe("unknown");
    expect(assessment.eligibility).toBe("unknown");
    expect(assessment.missingData).toContain("declared_path");
    expect(assessment.reasons).toContain("STUDENT_IS_CONTEXT_NOT_LEGAL_PATH");
    expect(assessment.humanReviewRequired).toBe(true);
  });

  it("fails open to uncertainty outside the Belgian ruleset instead of inventing law", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "FR",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        path: "professional_independent",
      },
      verification: DEFAULT_PROVIDER_LEGAL_VERIFICATION,
    });

    expect(assessment.path).toBe("unknown");
    expect(assessment.eligibility).toBe("unknown");
    expect(assessment.reasons).toContain("BELGIAN_RULESET_NOT_APPLICABLE");
    expect(assessment.humanReviewRequired).toBe(true);
  });

  it("keeps a declared professional independent path conditional while evidence is missing", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "BE",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        path: "professional_independent",
        selfEmploymentCapacity: "complementary",
        enterpriseNumber: "0123.456.789",
        socialInsuranceFundAffiliation: "yes",
      },
      verification: DEFAULT_PROVIDER_LEGAL_VERIFICATION,
    });

    expect(assessment.path).toBe("professional_independent");
    expect(assessment.eligibility).toBe("conditionally_eligible");
    expect(assessment.missingData).toEqual(
      expect.arrayContaining([
        "verified_enterprise_registration",
        "verified_social_insurance_fund",
      ])
    );
    expect(assessment.humanReviewRequired).toBe(true);
  });

  it("only makes the professional independent path eligible after evidence and matching human review", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "BE",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        path: "professional_independent",
        selfEmploymentCapacity: "student_independent",
        enterpriseNumber: "0123.456.789",
        socialInsuranceFundAffiliation: "yes",
        studentContext: "yes",
      },
      verification: {
        ...DEFAULT_PROVIDER_LEGAL_VERIFICATION,
        enterpriseRegistration: "verified",
        socialInsuranceFund: "verified",
        humanReview: "approved",
        reviewedPath: "professional_independent",
      },
    });

    expect(assessment.eligibility).toBe("eligible");
    expect(assessment.missingData).toEqual([]);
    expect(assessment.humanReviewRequired).toBe(false);
    expect(assessment.reasons).toContain("STUDENT_IS_CONTEXT_NOT_LEGAL_PATH");
    expect(assessment.reasons).toContain(
      "PROFESSIONAL_INDEPENDENT_PATH_DOES_NOT_OVERRIDE_WORKER_CLASSIFICATION"
    );
  });

  it("requires a verified employment arrangement for the employee-compatible path", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "BE",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        path: "employee_compatible",
      },
      verification: {
        ...DEFAULT_PROVIDER_LEGAL_VERIFICATION,
        humanReview: "approved",
        reviewedPath: "employee_compatible",
      },
    });

    expect(assessment.eligibility).toBe("conditionally_eligible");
    expect(assessment.missingData).toContain("verified_employment_arrangement");
    expect(assessment.reasons).toContain(
      "EMPLOYEE_COMPATIBLE_IS_OPERATIONAL_PATH_NOT_EMPLOYEE_STATUS"
    );
  });

  it("marks recurring activity as a conflict for the occasional path", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "BE",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        path: "occasional",
        activityFrequency: "recurring",
      },
      verification: DEFAULT_PROVIDER_LEGAL_VERIFICATION,
    });

    expect(assessment.eligibility).toBe("conditionally_eligible");
    expect(assessment.reasons).toContain(
      "OCCASIONAL_PATH_CONFLICTS_WITH_RECURRING_ACTIVITY"
    );
    expect(assessment.reasons).toContain(
      "OCCASIONAL_PATH_IS_NOT_AUTOMATIC_LEGAL_EXEMPTION"
    );
    expect(assessment.humanReviewRequired).toBe(true);
  });

  it("keeps a human rejection reversible but authoritative for eligibility", () => {
    const assessment = evaluateProviderLegalAuthority({
      jurisdictionCountryCode: "BE",
      declarations: {
        ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
        path: "occasional",
        activityFrequency: "one_off",
      },
      verification: {
        ...DEFAULT_PROVIDER_LEGAL_VERIFICATION,
        humanReview: "rejected",
        reviewedPath: "occasional",
      },
    });

    expect(assessment.eligibility).toBe("ineligible");
    expect(assessment.reasons).toContain("HUMAN_REVIEW_REJECTED");
  });

  it("exposes one stable authority contract for onboarding, Brain and payments", () => {
    const authority = buildProviderLegalAuthority({
      jurisdictionCountryCode: "be",
      declarations: DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
      verification: DEFAULT_PROVIDER_LEGAL_VERIFICATION,
    });

    expect(authority.source).toBe("klyx_provider_legal_authority");
    expect(authority.jurisdictionCountryCode).toBe("BE");
    expect(authority.assessment).toEqual(
      expect.objectContaining({
        path: "unknown",
        eligibility: "unknown",
        missingData: expect.any(Array),
        reasons: expect.any(Array),
        humanReviewRequired: true,
        rulesetVersion: "be-provider-legal-v1",
      })
    );
  });
});
