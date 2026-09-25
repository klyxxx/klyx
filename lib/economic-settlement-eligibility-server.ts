import "server-only";

import {
  evaluateSettlementEligibilitySnapshot,
  previousEconomicEligibilityState,
  type EconomicIdentitySource,
  type EconomicRestrictionSource,
  type ExternalProviderProjectionSource,
  type LegalSubjectSource,
  type QualificationSource,
  type TrustDecisionSource,
  type TrustRestrictionSource,
  type VerificationSource,
} from "@/lib/economic-settlement-eligibility-adapter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type EconomicSettlementEligibilityDecision =
  | "allowed"
  | "human_review"
  | "blocked";

export type EconomicSettlementEligibilityResult = {
  decisionId: string;
  decision: EconomicSettlementEligibilityDecision;
  reasonCodes: string[];
  sourceTrustDecisionId: string | null;
  stripeAccountId: string | null;
  activityKey: string;
  jurisdictionCode: string;
};

export type SettlementBookingContext = {
  bookingId: string;
  providerProfileId: string;
  userServiceId: string | null;
  activityKey: string;
  jurisdictionCode: string;
};

type EconomicIdentityRow = {
  id: string;
  status: string;
  human_review_required: boolean;
  review_reason_code: string | null;
};

type VerificationCaseRow = {
  id: string;
  verification_type: string;
  status: string;
  human_review_required: boolean;
  legal_entity_id: string | null;
  economic_person_id: string | null;
  expires_at: string | null;
};

type LegalEntityRow = {
  id: string;
  is_primary: boolean;
  verification_status: string;
  expires_at: string | null;
};

type EconomicPersonRow = {
  id: string;
  is_primary: boolean;
  verification_status: string;
  expires_at: string | null;
};

type EconomicRestrictionRow = {
  id: string;
  restricted_action: string;
  scope_type: string;
  activity_key: string | null;
  jurisdiction_code: string | null;
  status: string;
  reason_code: string;
  human_review_required: boolean;
  starts_at: string;
  ends_at: string | null;
};

type QualificationRow = {
  id: string;
  qualification_key: string;
  scope_type: string;
  scope_key: string;
  activity_key: string | null;
  jurisdiction_code: string | null;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
};

type TrustRestrictionRow = {
  id: string;
  scope_type: string;
  scope_key: string | null;
  restricted_action: string;
  status: string;
  human_review_required: boolean;
  starts_at: string;
  ends_at: string | null;
  reason_code: string;
};

type TrustDecisionRow = {
  id: string;
  target_type: string;
  target_ref: string | null;
  decision: string;
  human_review_required: boolean;
  review_status: string;
  reason_codes: unknown;
  required_actions: unknown;
  created_at: string;
  expires_at: string | null;
};

type CanonicalStripeRow = {
  identity_state: string;
  stripe_account_id: string | null;
};

type StripeProjectionRow = {
  economic_identity_id: string;
  account_id: string;
  stripe_account_id: string;
  payouts_enabled: boolean;
  currently_due: unknown;
  past_due: unknown;
  pending_verification: unknown;
  requirement_errors: unknown;
  disabled_reason: string | null;
  capabilities: unknown;
};

type PreviousDecisionRow = {
  decision: string;
  evidence_snapshot: unknown;
};

const DECISION_TTL_MS = 4 * 60 * 1000;

function normalizeActivityKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeJurisdictionCode(value: string): string {
  return value.trim().toUpperCase();
}

async function ensureEconomicIdentity(
  accountId: string
): Promise<EconomicIdentityRow> {
  const read = async () => {
    const { data, error } = await supabaseAdmin
      .from("economic_identities")
      .select("id, status, human_review_required, review_reason_code")
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as EconomicIdentityRow | null) ?? null;
  };

  const existing = await read();
  if (existing) return existing;

  const { error: insertError } = await supabaseAdmin
    .from("economic_identities")
    .insert({ account_id: accountId });

  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  const created = await read();
  if (!created) throw new Error("KLYX_ECONOMIC_IDENTITY_MISSING");
  return created;
}

async function recordDecision(input: {
  accountId: string;
  economicIdentityId: string;
  sourceTrustDecisionId: string | null;
  stripeAccountId: string | null;
  subjectType: string;
  subjectId: string;
  activityKey: string;
  jurisdictionCode: string;
  decision: EconomicSettlementEligibilityDecision;
  reasonCodes: string[];
  evidenceSnapshot: Record<string, unknown>;
  evaluatedAt: Date;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("economic_settlement_eligibility_decisions")
    .insert({
      account_id: input.accountId,
      economic_identity_id: input.economicIdentityId,
      source_trust_decision_id: input.sourceTrustDecisionId,
      stripe_account_id: input.stripeAccountId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      activity_key: input.activityKey,
      jurisdiction_code: input.jurisdictionCode,
      decision: input.decision,
      reason_codes: input.reasonCodes,
      evidence_snapshot: input.evidenceSnapshot,
      decision_source: "deterministic_rule",
      evaluated_at: input.evaluatedAt.toISOString(),
      expires_at: new Date(
        input.evaluatedAt.getTime() + DECISION_TTL_MS
      ).toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error("KLYX_ECONOMIC_SETTLEMENT_DECISION_NOT_RECORDED");
  }
  return String(data.id);
}

export async function loadSettlementBookingContext(input: {
  bookingId: string;
  expectedProviderProfileId?: string | null;
}): Promise<SettlementBookingContext | null> {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, provider_id, babysitter_id, user_service_id, service_id, country_code"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (bookingError) throw new Error(bookingError.message);
  if (!booking) return null;

  const providerProfileId = String(
    booking.provider_id ?? booking.babysitter_id ?? ""
  ).trim();
  if (
    !providerProfileId ||
    (input.expectedProviderProfileId &&
      providerProfileId !== input.expectedProviderProfileId)
  ) {
    return null;
  }

  let serviceId = booking.service_id ? String(booking.service_id) : null;
  const userServiceId = booking.user_service_id
    ? String(booking.user_service_id)
    : null;

  if (!serviceId && userServiceId) {
    const { data: userService, error: userServiceError } = await supabaseAdmin
      .from("user_services")
      .select("service_id")
      .eq("id", userServiceId)
      .maybeSingle();
    if (userServiceError) throw new Error(userServiceError.message);
    serviceId = userService?.service_id ? String(userService.service_id) : null;
  }

  if (!serviceId) return null;

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("slug")
    .eq("id", serviceId)
    .maybeSingle();
  if (serviceError) throw new Error(serviceError.message);

  const activityKey = service?.slug
    ? normalizeActivityKey(String(service.slug))
    : "";
  const jurisdictionCode = booking.country_code
    ? normalizeJurisdictionCode(String(booking.country_code))
    : "";
  if (!activityKey || !jurisdictionCode) return null;

  return {
    bookingId: String(booking.id),
    providerProfileId,
    userServiceId,
    activityKey,
    jurisdictionCode,
  };
}

export async function canReceiveSettlement(input: {
  accountId: string;
  activityKey: string;
  jurisdictionCode: string;
  subjectType: string;
  subjectId: string;
  expectedStripeAccountId: string;
  userServiceId?: string | null;
}): Promise<EconomicSettlementEligibilityResult> {
  const evaluatedAt = new Date();
  const activityKey = normalizeActivityKey(input.activityKey);
  const jurisdictionCode = normalizeJurisdictionCode(input.jurisdictionCode);
  const identity = await ensureEconomicIdentity(input.accountId);

  const [
    accountResult,
    capabilityResult,
    qualificationResult,
    canonicalStripeResult,
    trustRestrictionsResult,
    trustDecisionsResult,
    legalEntitiesResult,
    economicPersonsResult,
    verificationResult,
    economicRestrictionsResult,
    stripeProjectionResult,
    previousDecisionResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("id", input.accountId)
      .maybeSingle(),
    supabaseAdmin
      .from("account_actor_capabilities")
      .select("enabled")
      .eq("account_id", input.accountId)
      .eq("capability", "offer_services")
      .maybeSingle(),
    supabaseAdmin
      .from("account_capability_qualifications")
      .select(
        "id, qualification_key, scope_type, scope_key, activity_key, jurisdiction_code, status, valid_from, valid_until"
      )
      .eq("account_id", input.accountId)
      .eq("capability", "offer_services"),
    supabaseAdmin
      .from("account_stripe_connect_identities")
      .select("identity_state, stripe_account_id")
      .eq("account_id", input.accountId)
      .maybeSingle(),
    supabaseAdmin
      .from("trust_restrictions")
      .select(
        "id, scope_type, scope_key, restricted_action, status, human_review_required, starts_at, ends_at, reason_code"
      )
      .eq("account_id", input.accountId)
      .eq("status", "active"),
    supabaseAdmin
      .from("trust_eligibility_decisions")
      .select(
        "id, target_type, target_ref, decision, human_review_required, review_status, reason_codes, required_actions, created_at, expires_at"
      )
      .eq("account_id", input.accountId)
      .eq("category_key", activityKey)
      .eq("jurisdiction_code", jurisdictionCode)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("economic_legal_entities")
      .select("id, is_primary, verification_status, expires_at")
      .eq("economic_identity_id", identity.id),
    supabaseAdmin
      .from("economic_persons")
      .select("id, is_primary, verification_status, expires_at")
      .eq("economic_identity_id", identity.id),
    supabaseAdmin
      .from("economic_verification_cases")
      .select(
        "id, verification_type, status, human_review_required, legal_entity_id, economic_person_id, expires_at"
      )
      .eq("economic_identity_id", identity.id),
    supabaseAdmin
      .from("economic_restrictions")
      .select(
        "id, restricted_action, scope_type, activity_key, jurisdiction_code, status, reason_code, human_review_required, starts_at, ends_at"
      )
      .eq("economic_identity_id", identity.id)
      .eq("status", "active"),
    supabaseAdmin
      .from("economic_stripe_account_projections")
      .select(
        "economic_identity_id, account_id, stripe_account_id, payouts_enabled, currently_due, past_due, pending_verification, requirement_errors, disabled_reason, capabilities"
      )
      .eq("economic_identity_id", identity.id)
      .maybeSingle(),
    supabaseAdmin
      .from("economic_settlement_eligibility_decisions")
      .select("decision, evidence_snapshot")
      .eq("account_id", input.accountId)
      .eq("subject_type", input.subjectType)
      .eq("subject_id", input.subjectId)
      .eq("activity_key", activityKey)
      .eq("jurisdiction_code", jurisdictionCode)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const result of [
    accountResult,
    capabilityResult,
    qualificationResult,
    canonicalStripeResult,
    trustRestrictionsResult,
    trustDecisionsResult,
    legalEntitiesResult,
    economicPersonsResult,
    verificationResult,
    economicRestrictionsResult,
    stripeProjectionResult,
    previousDecisionResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const capability = capabilityResult.data as { enabled: boolean } | null;
  const qualifications = (qualificationResult.data ?? []) as QualificationRow[];
  const canonicalStripe =
    (canonicalStripeResult.data as CanonicalStripeRow | null) ?? null;
  const trustRestrictions =
    (trustRestrictionsResult.data ?? []) as TrustRestrictionRow[];
  const trustDecisions = (trustDecisionsResult.data ?? []) as TrustDecisionRow[];
  const legalEntities = (legalEntitiesResult.data ?? []) as LegalEntityRow[];
  const economicPersons = (economicPersonsResult.data ?? []) as EconomicPersonRow[];
  const verificationCases =
    (verificationResult.data ?? []) as VerificationCaseRow[];
  const economicRestrictions =
    (economicRestrictionsResult.data ?? []) as EconomicRestrictionRow[];
  const stripeProjection =
    (stripeProjectionResult.data as StripeProjectionRow | null) ?? null;
  const previousDecision =
    (previousDecisionResult.data as PreviousDecisionRow | null) ?? null;

  const economicIdentity: EconomicIdentitySource = {
    id: identity.id,
    status: identity.status,
    humanReviewRequired: identity.human_review_required,
    reviewReasonCode: identity.review_reason_code,
  };

  const legalSubjects: LegalSubjectSource[] = [
    ...legalEntities.map((row) => ({
      id: row.id,
      kind: "entity" as const,
      isPrimary: row.is_primary,
      verificationStatus: row.verification_status,
      expiresAt: row.expires_at,
    })),
    ...economicPersons.map((row) => ({
      id: row.id,
      kind: "person" as const,
      isPrimary: row.is_primary,
      verificationStatus: row.verification_status,
      expiresAt: row.expires_at,
    })),
  ];

  const verifications: VerificationSource[] = verificationCases.map((row) => ({
    id: row.id,
    verificationType: row.verification_type,
    status: row.status,
    humanReviewRequired: row.human_review_required,
    legalEntityId: row.legal_entity_id,
    economicPersonId: row.economic_person_id,
    expiresAt: row.expires_at,
  }));

  const qualificationSources: QualificationSource[] = qualifications.map((row) => ({
    id: row.id,
    qualificationKey: row.qualification_key,
    scopeType: row.scope_type,
    scopeKey: row.scope_key,
    activityKey: row.activity_key,
    jurisdictionCode: row.jurisdiction_code,
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
  }));

  const economicRestrictionSources: EconomicRestrictionSource[] =
    economicRestrictions.map((row) => ({
      id: row.id,
      restrictedAction: row.restricted_action,
      scopeType: row.scope_type,
      activityKey: row.activity_key,
      jurisdictionCode: row.jurisdiction_code,
      status: row.status,
      reasonCode: row.reason_code,
      humanReviewRequired: row.human_review_required,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    }));

  const trustRestrictionSources: TrustRestrictionSource[] = trustRestrictions.map(
    (row) => ({
      id: row.id,
      scopeType: row.scope_type,
      scopeKey: row.scope_key,
      restrictedAction: row.restricted_action,
      status: row.status,
      humanReviewRequired: row.human_review_required,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      reasonCode: row.reason_code,
    })
  );

  const trustDecisionSources: TrustDecisionSource[] = trustDecisions.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetRef: row.target_ref,
    decision: row.decision,
    humanReviewRequired: row.human_review_required,
    reviewStatus: row.review_status,
    reasonCodes: row.reason_codes,
    requiredActions: row.required_actions,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));

  const externalProviderProjection: ExternalProviderProjectionSource = stripeProjection
    ? {
        economicIdentityId: stripeProjection.economic_identity_id,
        accountId: stripeProjection.account_id,
        externalAccountRef: stripeProjection.stripe_account_id,
        payoutsEnabled: stripeProjection.payouts_enabled,
        currentlyDue: stripeProjection.currently_due,
        pastDue: stripeProjection.past_due,
        pendingVerification: stripeProjection.pending_verification,
        requirementErrors: stripeProjection.requirement_errors,
        disabledReason: stripeProjection.disabled_reason,
        capabilities: stripeProjection.capabilities,
      }
    : null;

  const evaluation = evaluateSettlementEligibilitySnapshot({
    accountId: input.accountId,
    accountExists: Boolean(accountResult.data),
    offerServicesEnabled: capability?.enabled === true,
    economicIdentity,
    legalSubjects,
    verifications,
    qualifications: qualificationSources,
    economicRestrictions: economicRestrictionSources,
    trustRestrictions: trustRestrictionSources,
    trustDecisions: trustDecisionSources,
    canonicalExternalIdentity: canonicalStripe
      ? {
          identityState: canonicalStripe.identity_state,
          externalAccountRef: canonicalStripe.stripe_account_id,
        }
      : null,
    externalProviderProjection,
    context: {
      activityKey,
      jurisdictionCode,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      userServiceId: input.userServiceId,
      expectedExternalAccountRef: input.expectedStripeAccountId,
      evaluatedAt: evaluatedAt.toISOString(),
    },
    previous: previousEconomicEligibilityState(
      previousDecision
        ? {
            decision: previousDecision.decision,
            evidenceSnapshot: previousDecision.evidence_snapshot,
          }
        : null
    ),
  });

  const decisionId = await recordDecision({
    accountId: input.accountId,
    economicIdentityId: identity.id,
    sourceTrustDecisionId: evaluation.sourceTrustDecisionId,
    stripeAccountId: evaluation.externalAccountRef,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    activityKey,
    jurisdictionCode,
    decision: evaluation.decision,
    reasonCodes: evaluation.reasonCodes,
    evidenceSnapshot: evaluation.evidenceSnapshot,
    evaluatedAt,
  });

  return {
    decisionId,
    decision: evaluation.decision,
    reasonCodes: evaluation.reasonCodes,
    sourceTrustDecisionId: evaluation.sourceTrustDecisionId,
    stripeAccountId: evaluation.externalAccountRef,
    activityKey,
    jurisdictionCode,
  };
}

export async function canReceiveSettlementForBooking(input: {
  accountId: string;
  bookingId: string;
  expectedProviderProfileId: string;
  expectedStripeAccountId: string;
}): Promise<EconomicSettlementEligibilityResult | null> {
  const context = await loadSettlementBookingContext({
    bookingId: input.bookingId,
    expectedProviderProfileId: input.expectedProviderProfileId,
  });
  if (!context) return null;

  return canReceiveSettlement({
    accountId: input.accountId,
    activityKey: context.activityKey,
    jurisdictionCode: context.jurisdictionCode,
    subjectType: "booking",
    subjectId: context.bookingId,
    expectedStripeAccountId: input.expectedStripeAccountId,
    userServiceId: context.userServiceId,
  });
}
