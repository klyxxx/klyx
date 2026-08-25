import "server-only";

// KLYX_SKILL_QUALIFICATION_COUNTRY_PHASE_5G
import {
  createDefaultSkillQualificationRule,
  type SkillProofType,
  type SkillQualificationRule,
} from "@/lib/skill-qualification-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

export {
  SKILL_PROOF_TYPES,
  evaluateSkillEvidence,
} from "@/lib/skill-qualification-policy";
export type {
  SkillProofType,
  SkillQualificationRule,
} from "@/lib/skill-qualification-policy";

export async function getSkillQualificationRule(params: {
  countryCode?: string | null;
  serviceSlug: string;
}): Promise<SkillQualificationRule> {
  const countryCode = String(params.countryCode ?? "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("KLYX_SKILL_COUNTRY_REQUIRED");
  }

  const { data, error } = await supabaseAdmin
    .from("skill_qualification_rules")
    .select(
      "country_code,service_slug,rule_level,required_proof_types,accepted_proof_types,minimum_years_experience,identity_required,insurance_required,official_registration_required,official_registration_label,legal_note,source_url"
    )
    .eq("country_code", countryCode)
    .eq("service_slug", params.serviceSlug)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return createDefaultSkillQualificationRule({
      countryCode,
      serviceSlug: params.serviceSlug,
    });
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
    officialRegistrationRequired:
      data.official_registration_required === true,
    officialRegistrationLabel:
      data.official_registration_label ?? null,
    legalNote: data.legal_note ?? null,
    sourceUrl: data.source_url ?? null,
  };
}
