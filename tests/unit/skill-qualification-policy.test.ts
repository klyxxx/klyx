import { describe, expect, it } from "vitest";

import {
  createDefaultSkillQualificationRule,
  evaluateSkillEvidence,
  evaluateSkillPublicEligibility,
  skillQualificationRequiresApproval,
  type SkillQualificationRule,
} from "../../lib/skill-qualification-policy";

function regulatedRule(
  overrides: Partial<SkillQualificationRule> = {}
): SkillQualificationRule {
  return {
    countryCode: "BE",
    serviceSlug: "regulated-service",
    ruleLevel: "regulated",
    requiredProofTypes: ["diploma"],
    acceptedProofTypes: [
      "diploma",
      "insurance",
      "professional_license",
    ],
    minimumYearsExperience: 3,
    identityRequired: true,
    insuranceRequired: true,
    officialRegistrationRequired: true,
    officialRegistrationLabel: "Inscription officielle",
    legalNote: null,
    sourceUrl: null,
    ...overrides,
  };
}

describe("KLYX provider skill qualification policy", () => {
  it("defaults an unconfigured skill to self declaration", () => {
    const rule = createDefaultSkillQualificationRule({
      countryCode: "BE",
      serviceSlug: "dog-walking",
    });

    expect(rule).toMatchObject({
      countryCode: "BE",
      serviceSlug: "dog-walking",
      ruleLevel: "self_declared",
      requiredProofTypes: [],
      minimumYearsExperience: 0,
      identityRequired: false,
      insuranceRequired: false,
      officialRegistrationRequired: false,
    });

    expect(
      evaluateSkillEvidence({
        rule,
        proofTypes: [],
        yearsExperience: 0,
        identityApproved: false,
      })
    ).toEqual({
      ready: true,
      missingProofTypes: [],
      experienceOk: true,
      identityOk: true,
    });
  });

  it("does not require KLYX approval for the unconfigured self-declared fallback", () => {
    const rule = createDefaultSkillQualificationRule({
      countryCode: "BE",
      serviceSlug: "dog-walking",
    });

    expect(skillQualificationRequiresApproval(rule)).toBe(false);
  });

  it("keeps an unconfigured self-declared skill public without calling it KLYX-approved", () => {
    const rule = createDefaultSkillQualificationRule({
      countryCode: "BE",
      serviceSlug: "dog-walking",
    });

    expect(
      evaluateSkillPublicEligibility({
        rule,
        proofTypes: [],
        yearsExperience: 0,
        identityApproved: false,
        verificationStatus: null,
      })
    ).toMatchObject({
      ready: true,
      approvalRequired: false,
      approvalOk: true,
      eligible: true,
      approved: false,
    });
  });

  it("requires KLYX approval as soon as an explicit qualification constraint exists", () => {
    expect(
      skillQualificationRequiresApproval(
        regulatedRule({
          ruleLevel: "self_declared",
          requiredProofTypes: [],
          minimumYearsExperience: 0,
          identityRequired: false,
          insuranceRequired: true,
          officialRegistrationRequired: false,
        })
      )
    ).toBe(true);

    expect(
      skillQualificationRequiresApproval(
        regulatedRule({
          ruleLevel: "evidence_required",
          requiredProofTypes: [],
          minimumYearsExperience: 0,
          identityRequired: false,
          insuranceRequired: false,
          officialRegistrationRequired: false,
        })
      )
    ).toBe(true);
  });

  it("never lets the self-declaration fallback bypass explicit regulated requirements", () => {
    const evaluation = evaluateSkillEvidence({
      rule: regulatedRule(),
      proofTypes: [],
      yearsExperience: 1,
      identityApproved: false,
    });

    expect(evaluation.ready).toBe(false);
    expect(evaluation.experienceOk).toBe(false);
    expect(evaluation.identityOk).toBe(false);
    expect(evaluation.missingProofTypes).toEqual([
      "diploma",
      "insurance",
      "professional_license",
    ]);
  });

  it("does not publish a regulated skill that lacks KLYX approval", () => {
    const evaluation = evaluateSkillPublicEligibility({
      rule: regulatedRule(),
      proofTypes: [
        "diploma",
        "insurance",
        "professional_license",
      ],
      yearsExperience: 3,
      identityApproved: true,
      verificationStatus: "submitted",
    });

    expect(evaluation).toMatchObject({
      ready: true,
      approvalRequired: true,
      approvalOk: false,
      eligible: false,
      approved: false,
    });
  });

  it("invalidates stale approval when current regulated evidence no longer satisfies the rule", () => {
    const evaluation = evaluateSkillPublicEligibility({
      rule: regulatedRule(),
      proofTypes: ["diploma"],
      yearsExperience: 3,
      identityApproved: true,
      verificationStatus: "approved",
    });

    expect(evaluation.ready).toBe(false);
    expect(evaluation.missingProofTypes).toEqual([
      "insurance",
      "professional_license",
    ]);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.approved).toBe(false);
  });

  it("accepts a regulated skill only when every explicit requirement is satisfied", () => {
    const evaluation = evaluateSkillEvidence({
      rule: regulatedRule(),
      proofTypes: [
        "diploma",
        "insurance",
        "professional_license",
      ],
      yearsExperience: 3,
      identityApproved: true,
    });

    expect(evaluation).toEqual({
      ready: true,
      missingProofTypes: [],
      experienceOk: true,
      identityOk: true,
    });
  });

  it("marks a regulated skill public and KLYX-approved only while approval and current evidence are both valid", () => {
    const evaluation = evaluateSkillPublicEligibility({
      rule: regulatedRule(),
      proofTypes: [
        "diploma",
        "insurance",
        "professional_license",
      ],
      yearsExperience: 3,
      identityApproved: true,
      verificationStatus: "approved",
    });

    expect(evaluation).toMatchObject({
      ready: true,
      approvalRequired: true,
      approvalOk: true,
      eligible: true,
      approved: true,
    });
  });

  it("dynamically invalidates approval when identity or experience stops satisfying the current rule", () => {
    const missingIdentity = evaluateSkillPublicEligibility({
      rule: regulatedRule(),
      proofTypes: [
        "diploma",
        "insurance",
        "professional_license",
      ],
      yearsExperience: 3,
      identityApproved: false,
      verificationStatus: "approved",
    });
    const insufficientExperience = evaluateSkillPublicEligibility({
      rule: regulatedRule(),
      proofTypes: [
        "diploma",
        "insurance",
        "professional_license",
      ],
      yearsExperience: 2,
      identityApproved: true,
      verificationStatus: "approved",
    });

    expect(missingIdentity).toMatchObject({
      identityOk: false,
      eligible: false,
      approved: false,
    });
    expect(insufficientExperience).toMatchObject({
      experienceOk: false,
      eligible: false,
      approved: false,
    });
  });

  it("deduplicates proof requirements added by regulatory flags", () => {
    const evaluation = evaluateSkillEvidence({
      rule: regulatedRule({
        requiredProofTypes: [
          "insurance",
          "professional_license",
        ],
        minimumYearsExperience: 0,
        identityRequired: false,
      }),
      proofTypes: [],
      yearsExperience: 0,
      identityApproved: false,
    });

    expect(evaluation.missingProofTypes).toEqual([
      "insurance",
      "professional_license",
    ]);
  });
});
