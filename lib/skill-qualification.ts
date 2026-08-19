import "server-only";

// KLYX_SKILL_QUALIFICATION_COUNTRY_PHASE_5G
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export async function getSkillQualificationRule(params: {
  countryCode?: string | null;
  serviceSlug: string;
}): Promise<SkillQualificationRule> {
  const countryCode =
    String(
      params.countryCode ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{2}$/.test(
      countryCode
    )
  ) {
    throw new Error(
      "KLYX_SKILL_COUNTRY_REQUIRED"
    );
  }

  const { data, error } = await supabaseAdmin
    .from("skill_qualification_rules")
    .select("country_code,service_slug,rule_level,required_proof_types,accepted_proof_types,minimum_years_experience,identity_required,insurance_required,official_registration_required,official_registration_label,legal_note,source_url")
    .eq("country_code", countryCode)
    .eq("service_slug", params.serviceSlug)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return {
      countryCode,
      serviceSlug: params.serviceSlug,
      ruleLevel: "evidence_required",
      requiredProofTypes: ["experience_reference"],
      acceptedProofTypes: ["experience_reference","training_certificate","diploma","portfolio"],
      minimumYearsExperience: 0,
      identityRequired: true,
      insuranceRequired: false,
      officialRegistrationRequired: false,
      officialRegistrationLabel: null,
      legalNote: "Aucune règle spécifique configurée : KLYX demande au minimum une preuve d'expérience.",
      sourceUrl: null,
    };
  }

  return {
    countryCode: data.country_code,
    serviceSlug: data.service_slug,
    ruleLevel: data.rule_level,
    requiredProofTypes: (data.required_proof_types ?? []) as SkillProofType[],
    acceptedProofTypes: (data.accepted_proof_types ?? []) as SkillProofType[],
    minimumYearsExperience: Number(data.minimum_years_experience) || 0,
    identityRequired: data.identity_required !== false,
    insuranceRequired: data.insurance_required === true,
    officialRegistrationRequired: data.official_registration_required === true,
    officialRegistrationLabel: data.official_registration_label ?? null,
    legalNote: data.legal_note ?? null,
    sourceUrl: data.source_url ?? null,
  };
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
  if (params.rule.officialRegistrationRequired) missing.push("professional_license");

  const missingProofTypes = Array.from(new Set(missing)).filter(
    (proof) => !available.has(proof)
  );

  return {
    ready:
      missingProofTypes.length === 0 &&
      params.yearsExperience >= params.rule.minimumYearsExperience &&
      (!params.rule.identityRequired || params.identityApproved),
    missingProofTypes,
    experienceOk: params.yearsExperience >= params.rule.minimumYearsExperience,
    identityOk: !params.rule.identityRequired || params.identityApproved,
  };
}
