import "server-only";

import type { ActiveProfile } from "@/lib/active-profile";
import {
  buildProviderLegalAuthority,
  DEFAULT_PROVIDER_LEGAL_DECLARATIONS,
  DEFAULT_PROVIDER_LEGAL_VERIFICATION,
  PROVIDER_ACTIVITY_FREQUENCIES,
  PROVIDER_DECLARATION_STATES,
  PROVIDER_LEGAL_PATHS,
  PROVIDER_SELF_EMPLOYMENT_CAPACITIES,
  PROVIDER_STUDENT_CONTEXTS,
  type ProviderActivityFrequency,
  type ProviderDeclarationState,
  type ProviderLegalAuthority,
  type ProviderLegalDeclarations,
  type ProviderLegalPath,
  type ProviderSelfEmploymentCapacity,
  type ProviderStudentContext,
} from "@/lib/provider-legal-authority";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ProviderLegalProfileRow = {
  profile_id: string;
  declared_path: string;
  declared_student_context: string;
  declared_activity_frequency: string;
  declared_self_employment_capacity: string;
  declared_enterprise_number: string | null;
  declared_social_insurance_fund_affiliation: string;
  enterprise_registration_verification: string;
  social_insurance_fund_verification: string;
  employment_arrangement_verification: string;
  human_review_status: string;
  human_reviewed_path: string | null;
};

export type ProviderLegalDeclarationPatch = Partial<{
  path: ProviderLegalPath;
  studentContext: ProviderStudentContext;
  activityFrequency: ProviderActivityFrequency;
  selfEmploymentCapacity: ProviderSelfEmploymentCapacity;
  enterpriseNumber: string | null;
  socialInsuranceFundAffiliation: ProviderDeclarationState;
}>;

const SELECT_COLUMNS = [
  "profile_id",
  "declared_path",
  "declared_student_context",
  "declared_activity_frequency",
  "declared_self_employment_capacity",
  "declared_enterprise_number",
  "declared_social_insurance_fund_affiliation",
  "enterprise_registration_verification",
  "social_insurance_fund_verification",
  "employment_arrangement_verification",
  "human_review_status",
  "human_reviewed_path",
].join(", ");

function enumValue<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function declarationsFromRow(
  row: ProviderLegalProfileRow | null
): ProviderLegalDeclarations {
  if (!row) return { ...DEFAULT_PROVIDER_LEGAL_DECLARATIONS };

  return {
    path: enumValue(row.declared_path, PROVIDER_LEGAL_PATHS, "unknown"),
    studentContext: enumValue(
      row.declared_student_context,
      PROVIDER_STUDENT_CONTEXTS,
      "unknown"
    ),
    activityFrequency: enumValue(
      row.declared_activity_frequency,
      PROVIDER_ACTIVITY_FREQUENCIES,
      "unknown"
    ),
    selfEmploymentCapacity: enumValue(
      row.declared_self_employment_capacity,
      PROVIDER_SELF_EMPLOYMENT_CAPACITIES,
      "unknown"
    ),
    enterpriseNumber: row.declared_enterprise_number?.trim() || null,
    socialInsuranceFundAffiliation: enumValue(
      row.declared_social_insurance_fund_affiliation,
      PROVIDER_DECLARATION_STATES,
      "unknown"
    ),
  };
}

function verificationFromRow(row: ProviderLegalProfileRow | null) {
  if (!row) return { ...DEFAULT_PROVIDER_LEGAL_VERIFICATION };

  const verificationStates = [
    "unknown",
    "pending",
    "verified",
    "rejected",
  ] as const;
  const reviewStates = [
    "not_reviewed",
    "pending",
    "approved",
    "rejected",
  ] as const;

  return {
    enterpriseRegistration: enumValue(
      row.enterprise_registration_verification,
      verificationStates,
      "unknown"
    ),
    socialInsuranceFund: enumValue(
      row.social_insurance_fund_verification,
      verificationStates,
      "unknown"
    ),
    employmentArrangement: enumValue(
      row.employment_arrangement_verification,
      verificationStates,
      "unknown"
    ),
    humanReview: enumValue(
      row.human_review_status,
      reviewStates,
      "not_reviewed"
    ),
    reviewedPath: row.human_reviewed_path
      ? enumValue(row.human_reviewed_path, PROVIDER_LEGAL_PATHS, "unknown")
      : null,
  };
}

async function readProviderLegalRow(
  profileId: string
): Promise<ProviderLegalProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("provider_legal_profiles")
    .select(SELECT_COLUMNS)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load provider legal authority: ${error.message}`);
  }

  return (data as ProviderLegalProfileRow | null) ?? null;
}

export async function getProviderLegalAuthority(
  profile: ActiveProfile
): Promise<ProviderLegalAuthority> {
  const row = await readProviderLegalRow(profile.id);

  return buildProviderLegalAuthority({
    jurisdictionCountryCode: profile.countryCode,
    declarations: declarationsFromRow(row),
    verification: verificationFromRow(row),
  });
}

function declarationPatchToDatabase(
  current: ProviderLegalDeclarations,
  patch: ProviderLegalDeclarationPatch
) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.path !== undefined) update.declared_path = patch.path;
  if (patch.studentContext !== undefined) {
    update.declared_student_context = patch.studentContext;
  }
  if (patch.activityFrequency !== undefined) {
    update.declared_activity_frequency = patch.activityFrequency;
  }
  if (patch.selfEmploymentCapacity !== undefined) {
    update.declared_self_employment_capacity = patch.selfEmploymentCapacity;
  }
  if (patch.enterpriseNumber !== undefined) {
    update.declared_enterprise_number = patch.enterpriseNumber;
  }
  if (patch.socialInsuranceFundAffiliation !== undefined) {
    update.declared_social_insurance_fund_affiliation =
      patch.socialInsuranceFundAffiliation;
  }

  const pathChanged = patch.path !== undefined && patch.path !== current.path;
  const enterpriseChanged =
    patch.enterpriseNumber !== undefined &&
    patch.enterpriseNumber !== current.enterpriseNumber;
  const socialFundChanged =
    patch.socialInsuranceFundAffiliation !== undefined &&
    patch.socialInsuranceFundAffiliation !==
      current.socialInsuranceFundAffiliation;
  const anyDeclarationChanged = Object.keys(update).length > 1;

  if (enterpriseChanged) {
    update.enterprise_registration_verification = "unknown";
  }
  if (socialFundChanged) {
    update.social_insurance_fund_verification = "unknown";
  }
  if (pathChanged) {
    update.employment_arrangement_verification = "unknown";
  }

  if (anyDeclarationChanged) {
    // Provider declarations can invalidate a prior human conclusion, but can
    // never approve themselves or keep an approval attached to stale facts.
    update.human_review_status = "not_reviewed";
    update.human_reviewed_path = null;
    update.human_reviewed_by = null;
    update.human_reviewed_at = null;
    update.human_review_note = null;
  }

  return update;
}

export async function updateProviderLegalDeclarations(
  profile: ActiveProfile,
  patch: ProviderLegalDeclarationPatch
): Promise<ProviderLegalAuthority> {
  const currentRow = await readProviderLegalRow(profile.id);
  const currentDeclarations = declarationsFromRow(currentRow);
  const update = declarationPatchToDatabase(currentDeclarations, patch);

  const payload = {
    profile_id: profile.id,
    ...update,
  };

  const { error } = await supabaseAdmin
    .from("provider_legal_profiles")
    .upsert(payload, { onConflict: "profile_id" });

  if (error) {
    throw new Error(`Unable to save provider legal authority: ${error.message}`);
  }

  return getProviderLegalAuthority(profile);
}
