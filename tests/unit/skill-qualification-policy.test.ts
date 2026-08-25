import { describe, expect, it } from "vitest";

import {
  createDefaultSkillQualificationRule,
  evaluateSkillEvidence,
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
