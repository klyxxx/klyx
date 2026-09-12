import "server-only";

import type { ActiveProfile } from "@/lib/active-profile";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  evaluateTrustSafetyAuthority,
  TRUST_SAFETY_ACTIVITY_FREQUENCIES,
  TRUST_SAFETY_IDENTITY_LEVELS,
  TRUST_SAFETY_LEGAL_PATHS,
  TRUST_SAFETY_REVIEW_STATES,
  TRUST_SAFETY_TRUST_LEVELS,
  TRUST_SAFETY_VERIFICATION_STATES,
  type TrustSafetyActivityFrequency,
  type TrustSafetyAuthority,
  type TrustSafetyCategoryPolicy,
  type TrustSafetyFacts,
  type TrustSafetyIdentityLevel,
  type TrustSafetyLegalPath,
  type TrustSafetyRestriction,
  type TrustSafetyReviewState,
  type TrustSafetyTrustLevel,
  type TrustSafetyVerificationState,
} from "@/lib/trust-safety-authority";

type TrustProfileRow = {
  profile_id: string;
  jurisdiction_country_code: string | null;
  declared_legal_path: string;
  declared_activity_frequency: string;
  identity_level: string;
  trust_level: string;
  legal_path_review_status: string;
  legal_path_reviewed_path: string | null;
};

type LegacyProviderLegalRow = {
  declared_path: string;
  declared_activity_frequency: string;
  enterprise_registration_verification: string;
  social_insurance_fund_verification: string;
  employment_arrangement_verification: string;
  human_review_status: string;
  human_reviewed_path: string | null;
};

type LegacyProviderVerificationRow = {
  identity_status: string | null;
  trust_level: string | null;
};

type PolicyRow = {
  jurisdiction_country_code: string;
  category_key: string;
  risk_tier: string;
  required_identity_level: string;
  minimum_trust_level: string;
  required_qualifications: string[] | null;
  required_verifications: string[] | null;
  allowed_legal_paths: string[] | null;
  human_review_mode: string;
};

type QualificationRow = {
  category_key: string;
  qualification_key: string;
  status: string;
};

type VerificationRow = {
  verification_key: string;
  status: string;
};

type RestrictionRow = {
  id: string;
  scope: string;
  category_key: string | null;
  action: string;
  status: string;
  reason_code: string;
  explanation: string;
  ends_at: string | null;
  review_status: string;
};

export type TrustSafetyDeclarationPatch = Partial<{
  legalPath: TrustSafetyLegalPath;
  activityFrequency: TrustSafetyActivityFrequency;
}>;

function enumValue<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

export function sanitizeTrustSafetyCategoryKey(value: string | null | undefined): string {
  const category = (value ?? "*").trim().toLowerCase();
  if (category === "*") return category;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(category)) {
    throw new Error("Invalid trust and safety category key");
  }
  return category;
}

function legacyPath(value: string | null | undefined): TrustSafetyLegalPath {
  if (value === "occasional") return "occasional_compatible";
  if (value === "employee_compatible") return "employment_via_structure";
  if (value === "professional_independent") return "professional_independent";
  return "unknown";
}

function legacyIdentity(value: string | null | undefined): TrustSafetyIdentityLevel {
  if (value === "approved" || value === "verified") return "verified";
  if (value && !["missing", "rejected"].includes(value)) return "basic";
  return "unknown";
}

function legacyTrust(value: string | null | undefined): TrustSafetyTrustLevel {
  if (value === "restricted" || value === "blocked") return "restricted";
  if (value === "trusted" || value === "strong") return "strong";
  if (value === "identity_verified" || value === "verified") return "standard";
  if (value === "new" || value === "basic") return "limited";
  return "unknown";
}

async function readTrustProfile(profileId: string): Promise<TrustProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("trust_safety_profiles")
    .select(
      "profile_id, jurisdiction_country_code, declared_legal_path, declared_activity_frequency, identity_level, trust_level, legal_path_review_status, legal_path_reviewed_path"
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load Trust & Safety profile: ${error.message}`);
  return (data as TrustProfileRow | null) ?? null;
}

async function readLegacyProviderState(profileId: string) {
  const [legalResult, verificationResult] = await Promise.all([
    supabaseAdmin
      .from("provider_legal_profiles")
      .select(
        "declared_path, declared_activity_frequency, enterprise_registration_verification, social_insurance_fund_verification, employment_arrangement_verification, human_review_status, human_reviewed_path"
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabaseAdmin
      .from("provider_verifications")
      .select("identity_status, trust_level")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  if (legalResult.error) {
    throw new Error(`Unable to load legacy legal authority: ${legalResult.error.message}`);
  }
  if (verificationResult.error) {
    throw new Error(`Unable to load legacy verification: ${verificationResult.error.message}`);
  }

  return {
    legal: (legalResult.data as LegacyProviderLegalRow | null) ?? null,
    verification:
      (verificationResult.data as LegacyProviderVerificationRow | null) ?? null,
  };
}

function policyFromRow(row: PolicyRow): TrustSafetyCategoryPolicy {
  return {
    jurisdictionCountryCode: row.jurisdiction_country_code,
    categoryKey: row.category_key,
    riskTier: enumValue(row.risk_tier, ["standard", "elevated", "sensitive"] as const, "standard"),
    requiredIdentityLevel: enumValue(
      row.required_identity_level,
      TRUST_SAFETY_IDENTITY_LEVELS,
      "basic"
    ),
    minimumTrustLevel: enumValue(
      row.minimum_trust_level,
      ["unknown", "limited", "standard", "strong"] as const,
      "limited"
    ),
    requiredQualifications: row.required_qualifications ?? [],
    requiredVerifications: row.required_verifications ?? [],
    allowedLegalPaths: (row.allowed_legal_paths ?? [])
      .map((value) => enumValue(value, TRUST_SAFETY_LEGAL_PATHS, "unknown"))
      .filter((value) => value !== "unknown"),
    humanReviewMode: enumValue(
      row.human_review_mode,
      ["never", "if_sensitive", "always"] as const,
      "always"
    ),
  };
}

async function readPolicy(
  countryCode: string | null,
  categoryKey: string
): Promise<TrustSafetyCategoryPolicy> {
  const jurisdiction = countryCode?.trim().toUpperCase() || "ZZ";
  const { data, error } = await supabaseAdmin
    .from("trust_safety_category_policies")
    .select(
      "jurisdiction_country_code, category_key, risk_tier, required_identity_level, minimum_trust_level, required_qualifications, required_verifications, allowed_legal_paths, human_review_mode"
    )
    .eq("jurisdiction_country_code", jurisdiction)
    .eq("is_active", true)
    .in("category_key", [categoryKey, "*"]);
  if (error) throw new Error(`Unable to load Trust & Safety policy: ${error.message}`);

  const rows = (data ?? []) as PolicyRow[];
  const exact = rows.find((row) => row.category_key === categoryKey);
  const fallback = rows.find((row) => row.category_key === "*");
  if (exact || fallback) return policyFromRow(exact ?? fallback!);

  return {
    jurisdictionCountryCode: jurisdiction,
    categoryKey,
    riskTier: "elevated",
    requiredIdentityLevel: "verified",
    minimumTrustLevel: "standard",
    requiredQualifications: [],
    requiredVerifications: [],
    allowedLegalPaths: [
      "occasional_compatible",
      "employment_via_structure",
      "professional_independent",
    ],
    humanReviewMode: "always",
  };
}

async function readQualificationStates(
  profileId: string,
  categoryKey: string
): Promise<Record<string, TrustSafetyVerificationState>> {
  const { data, error } = await supabaseAdmin
    .from("trust_safety_qualifications")
    .select("category_key, qualification_key, status")
    .eq("profile_id", profileId)
    .in("category_key", [categoryKey, "*"]);
  if (error) throw new Error(`Unable to load qualifications: ${error.message}`);

  const result: Record<string, TrustSafetyVerificationState> = {};
  const rows = (data ?? []) as QualificationRow[];
  for (const row of rows.filter((item) => item.category_key === "*")) {
    result[row.qualification_key] = enumValue(
      row.status,
      TRUST_SAFETY_VERIFICATION_STATES,
      "unknown"
    );
  }
  for (const row of rows.filter((item) => item.category_key === categoryKey)) {
    result[row.qualification_key] = enumValue(
      row.status,
      TRUST_SAFETY_VERIFICATION_STATES,
      "unknown"
    );
  }
  return result;
}

async function readVerificationStates(
  profileId: string,
  legacy: LegacyProviderLegalRow | null
): Promise<Record<string, TrustSafetyVerificationState>> {
  const result: Record<string, TrustSafetyVerificationState> = {};
  if (legacy) {
    result.enterprise_registration = enumValue(
      legacy.enterprise_registration_verification,
      TRUST_SAFETY_VERIFICATION_STATES,
      "unknown"
    );
    result.social_insurance_fund = enumValue(
      legacy.social_insurance_fund_verification,
      TRUST_SAFETY_VERIFICATION_STATES,
      "unknown"
    );
    result.employment_arrangement = enumValue(
      legacy.employment_arrangement_verification,
      TRUST_SAFETY_VERIFICATION_STATES,
      "unknown"
    );
  }

  const { data, error } = await supabaseAdmin
    .from("trust_safety_verifications")
    .select("verification_key, status")
    .eq("profile_id", profileId);
  if (error) throw new Error(`Unable to load verifications: ${error.message}`);
  for (const row of (data ?? []) as VerificationRow[]) {
    result[row.verification_key] = enumValue(
      row.status,
      TRUST_SAFETY_VERIFICATION_STATES,
      "unknown"
    );
  }
  return result;
}

async function readRestrictions(profileId: string): Promise<TrustSafetyRestriction[]> {
  const { data, error } = await supabaseAdmin
    .from("trust_safety_restrictions")
    .select(
      "id, scope, category_key, action, status, reason_code, explanation, ends_at, review_status"
    )
    .eq("profile_id", profileId)
    .in("status", ["active", "under_review"]);
  if (error) throw new Error(`Unable to load restrictions: ${error.message}`);

  return ((data ?? []) as RestrictionRow[]).map((row) => ({
    id: row.id,
    scope: enumValue(row.scope, ["global", "category"] as const, "global"),
    categoryKey: row.category_key,
    action: enumValue(
      row.action,
      ["manual_review_only", "category_block", "mission_block"] as const,
      "manual_review_only"
    ),
    status: enumValue(
      row.status,
      ["active", "under_review", "lifted", "expired"] as const,
      "under_review"
    ),
    reasonCode: row.reason_code,
    explanation: row.explanation,
    endsAt: row.ends_at,
    reviewStatus: enumValue(
      row.review_status,
      ["not_requested", "pending", "upheld", "modified", "lifted"] as const,
      "not_requested"
    ),
  }));
}

async function readSignalCounts(profileId: string) {
  const [reportsResult, disputesResult] = await Promise.all([
    supabaseAdmin
      .from("trust_safety_reports")
      .select("report_type")
      .eq("subject_profile_id", profileId)
      .in("status", ["open", "under_review", "waiting_information"]),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("against_profile_id", profileId)
      .in("status", ["open", "under_review", "waiting_user"]),
  ]);
  if (reportsResult.error) throw new Error(`Unable to load safety reports: ${reportsResult.error.message}`);
  if (disputesResult.error) throw new Error(`Unable to load disputes: ${disputesResult.error.message}`);

  const reports = (reportsResult.data ?? []) as Array<{ report_type: string }>;
  return {
    unresolvedSafetyReports: reports.filter((row) => row.report_type === "safety").length,
    unresolvedFraudReports: reports.filter((row) => row.report_type === "fraud").length,
    unresolvedNoShows: reports.filter((row) => row.report_type === "no_show").length,
    unresolvedDisputes: disputesResult.count ?? 0,
  };
}

export async function getTrustSafetyAuthority(
  profile: ActiveProfile,
  requestedCategoryKey: string
): Promise<TrustSafetyAuthority & { facts: TrustSafetyFacts; policy: TrustSafetyCategoryPolicy }> {
  const categoryKey = sanitizeTrustSafetyCategoryKey(requestedCategoryKey);
  const [trustProfile, legacy, policy, qualifications, restrictions, signals] =
    await Promise.all([
      readTrustProfile(profile.id),
      readLegacyProviderState(profile.id),
      readPolicy(profile.countryCode, categoryKey),
      readQualificationStates(profile.id, categoryKey),
      readRestrictions(profile.id),
      readSignalCounts(profile.id),
    ]);

  const verifications = await readVerificationStates(profile.id, legacy.legal);
  const declaredLegalPath = trustProfile
    ? enumValue(trustProfile.declared_legal_path, TRUST_SAFETY_LEGAL_PATHS, "unknown")
    : legacyPath(legacy.legal?.declared_path);
  const activityFrequency = trustProfile
    ? enumValue(
        trustProfile.declared_activity_frequency,
        TRUST_SAFETY_ACTIVITY_FREQUENCIES,
        "unknown"
      )
    : enumValue(
        legacy.legal?.declared_activity_frequency,
        TRUST_SAFETY_ACTIVITY_FREQUENCIES,
        "unknown"
      );
  const identityLevel = trustProfile
    ? enumValue(trustProfile.identity_level, TRUST_SAFETY_IDENTITY_LEVELS, "unknown")
    : legacyIdentity(legacy.verification?.identity_status);
  const trustLevel = trustProfile
    ? enumValue(trustProfile.trust_level, TRUST_SAFETY_TRUST_LEVELS, "unknown")
    : legacyTrust(legacy.verification?.trust_level);
  const legalPathReview: TrustSafetyReviewState = trustProfile
    ? enumValue(trustProfile.legal_path_review_status, TRUST_SAFETY_REVIEW_STATES, "not_reviewed")
    : enumValue(legacy.legal?.human_review_status, TRUST_SAFETY_REVIEW_STATES, "not_reviewed");
  const reviewedLegalPath = trustProfile?.legal_path_reviewed_path
    ? enumValue(trustProfile.legal_path_reviewed_path, TRUST_SAFETY_LEGAL_PATHS, "unknown")
    : legacyPath(legacy.legal?.human_reviewed_path);

  const facts: TrustSafetyFacts = {
    jurisdictionCountryCode:
      trustProfile?.jurisdiction_country_code ?? profile.countryCode,
    identityLevel,
    trustLevel,
    declaredLegalPath,
    activityFrequency,
    legalPathReview,
    reviewedLegalPath: reviewedLegalPath === "unknown" ? null : reviewedLegalPath,
    qualifications,
    verifications,
    restrictions,
    ...signals,
  };

  return {
    ...evaluateTrustSafetyAuthority({ facts, policy }),
    facts,
    policy,
  };
}

export async function updateTrustSafetyDeclarations(
  profile: ActiveProfile,
  patch: TrustSafetyDeclarationPatch
) {
  const current = await readTrustProfile(profile.id);
  const currentPath = current
    ? enumValue(current.declared_legal_path, TRUST_SAFETY_LEGAL_PATHS, "unknown")
    : "unknown";
  const currentFrequency = current
    ? enumValue(
        current.declared_activity_frequency,
        TRUST_SAFETY_ACTIVITY_FREQUENCIES,
        "unknown"
      )
    : "unknown";

  const legalPath = patch.legalPath ?? currentPath;
  const activityFrequency = patch.activityFrequency ?? currentFrequency;
  const changed = legalPath !== currentPath || activityFrequency !== currentFrequency;
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    profile_id: profile.id,
    jurisdiction_country_code: profile.countryCode?.trim().toUpperCase() ?? null,
    declared_legal_path: legalPath,
    declared_activity_frequency: activityFrequency,
    updated_at: now,
  };

  if (changed) {
    payload.legal_path_review_status = "not_reviewed";
    payload.legal_path_reviewed_path = null;
    payload.legal_path_reviewed_by = null;
    payload.legal_path_reviewed_at = null;
    payload.legal_path_review_note = null;
  }

  const { error } = await supabaseAdmin
    .from("trust_safety_profiles")
    .upsert(payload, { onConflict: "profile_id" });
  if (error) throw new Error(`Unable to save Trust & Safety declarations: ${error.message}`);

  const { error: auditError } = await supabaseAdmin
    .from("trust_safety_audit_events")
    .insert({
      subject_profile_id: profile.id,
      actor_profile_id: profile.id,
      event_type: "declarations_updated",
      object_type: "trust_safety_profile",
      object_id: profile.id,
      reason_codes: changed ? ["HUMAN_REVIEW_INVALIDATED_BY_CHANGED_FACTS"] : [],
      detail: { legalPath, activityFrequency },
    });
  if (auditError) throw new Error(`Unable to write Trust & Safety audit event: ${auditError.message}`);

  return { legalPath, activityFrequency, humanReviewInvalidated: changed };
}
