export const SKILL_PROOF_TYPES = [
  "diploma",
  "training_certificate",
  "professional_license",
  "insurance",
  "experience_reference",
  "portfolio",
  "other",
] as const;

export type SkillProofType = (typeof SKILL_PROOF_TYPES)[number];

export type SkillQualificationRule = {
  countryCode: string;
  serviceSlug: string;
  ruleLevel: "self_declared" | "evidence_required" | "regulated";
  requiredProofTypes: SkillProofType[];
  acceptedProofTypes: SkillProofType[];
  minimumYearsExperience: number;
  identityRequired: boolean;
  insuranceRequired: boolean;
  officialRegistrationRequired: boolean;
  officialRegistrationLabel: string | null;
  legalNote: string | null;
  sourceUrl: string | null;
};

export function createDefaultSkillQualificationRule(params: {
  countryCode: string;
  serviceSlug: string;
}): SkillQualificationRule {
  return {
    countryCode: params.countryCode,
    serviceSlug: params.serviceSlug,
    ruleLevel: "self_declared",
    requiredProofTypes: [],
    acceptedProofTypes: [
      "experience_reference",
      "training_certificate",
      "diploma",
      "portfolio",
    ],
    minimumYearsExperience: 0,
    identityRequired: false,
    insuranceRequired: false,
    officialRegistrationRequired: false,
    officialRegistrationLabel: null,
    legalNote:
      "Aucune règle spécifique configurée : cette compétence peut être auto-déclarée.",
    sourceUrl: null,
  };
}

export function skillQualificationRequiresApproval(
  rule: SkillQualificationRule
): boolean {
  return (
    rule.ruleLevel !== "self_declared" ||
    rule.requiredProofTypes.length > 0 ||
    rule.minimumYearsExperience > 0 ||
    rule.identityRequired ||
    rule.insuranceRequired ||
    rule.officialRegistrationRequired
  );
}

export function evaluateSkillEvidence(params: {
  rule: SkillQualificationRule;
  proofTypes: string[];
  yearsExperience: number;
  identityApproved: boolean;
}) {
  const available = new Set(params.proofTypes);
  const missing = [...params.rule.requiredProofTypes];

  if (params.rule.insuranceRequired) missing.push("insurance");
  if (params.rule.officialRegistrationRequired) {
    missing.push("professional_license");
  }

  const missingProofTypes = Array.from(new Set(missing)).filter(
    (proof) => !available.has(proof)
  );
  const experienceOk =
    params.yearsExperience >= params.rule.minimumYearsExperience;
  const identityOk =
    !params.rule.identityRequired || params.identityApproved;

  return {
    ready:
      missingProofTypes.length === 0 && experienceOk && identityOk,
    missingProofTypes,
    experienceOk,
    identityOk,
  };
}
