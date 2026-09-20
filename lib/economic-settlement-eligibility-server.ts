import "server-only";

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
  details_submitted: boolean;
  payouts_enabled: boolean;
  currently_due: unknown;
  eventually_due: unknown;
  past_due: unknown;
  pending_verification: unknown;
  requirement_errors: unknown;
  disabled_reason: string | null;
  capabilities: unknown;
  provider_observed_at: string;
};

const DECISION_TTL_MS = 4 * 60 * 1000;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return asArray(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function activeWindow(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  nowMs: number
): boolean {
  const starts = startsAt ? Date.parse(startsAt) : Number.NaN;
  const ends = endsAt ? Date.parse(endsAt) : Number.NaN;

  if (Number.isFinite(starts) && starts > nowMs) return false;
  if (endsAt && Number.isFinite(ends) && ends <= nowMs) return false;
  return true;
}

function normalizeActivityKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeJurisdictionCode(value: string): string {
  return value.trim().toUpperCase();
}

function economicRestrictionApplies(
  restriction: EconomicRestrictionRow,
  activityKey: string,
  jurisdictionCode: string,
  nowMs: number
): boolean {
  if (
    restriction.status !== "active" ||
    !activeWindow(restriction.starts_at, restriction.ends_at, nowMs)
  ) {
    return false;
  }

  if (
    ![
      "receive_settlement",
      "settlement_release",
      "receive_payouts",
      "use_platform",
    ].includes(restriction.restricted_action)
  ) {
    return false;
  }

  switch (restriction.scope_type) {
    case "global":
      return true;
    case "activity":
      return restriction.activity_key === activityKey;
    case "jurisdiction":
      return restriction.jurisdiction_code === jurisdictionCode;
    case "activity_jurisdiction":
      return (
        restriction.activity_key === activityKey &&
        restriction.jurisdiction_code === jurisdictionCode
      );
    default:
      return true;
  }
}

function trustRestrictionApplies(
  restriction: TrustRestrictionRow,
  input: {
    activityKey: string;
    userServiceId?: string | null;
    subjectType: string;
    subjectId: string;
  },
  nowMs: number
): boolean {
  if (
    restriction.status !== "active" ||
    !activeWindow(restriction.starts_at, restriction.ends_at, nowMs)
  ) {
    return false;
  }

  if (!["receive_payouts", "use_platform"].includes(restriction.restricted_action)) {
    return false;
  }

  switch (restriction.scope_type) {
    case "platform":
      return true;
    case "category":
      return restriction.scope_key === input.activityKey;
    case "service":
      return Boolean(
        restriction.scope_key &&
          (restriction.scope_key === input.userServiceId ||
            restriction.scope_key === input.activityKey)
      );
    case "booking":
      return (
        input.subjectType === "booking" &&
        restriction.scope_key === input.subjectId
      );
    default:
      return true;
  }
}

function qualificationApplies(
  qualification: QualificationRow,
  input: {
    activityKey: string;
    jurisdictionCode: string;
    userServiceId?: string | null;
  }
): boolean {
  if (
    qualification.activity_key &&
    qualification.activity_key !== input.activityKey
  ) {
    return false;
  }

  if (
    qualification.jurisdiction_code &&
    qualification.jurisdiction_code !== input.jurisdictionCode
  ) {
    return false;
  }

  if (qualification.scope_type === "global") return true;

  if (qualification.scope_type === "user_service") {
    return (
      Boolean(input.userServiceId) &&
      qualification.scope_key === input.userServiceId
    );
  }

  if (
    ["activity", "category", "service"].includes(qualification.scope_type)
  ) {
    return (
      qualification.scope_key === input.activityKey ||
      qualification.scope_key === input.userServiceId
    );
  }

  return Boolean(
    qualification.activity_key || qualification.jurisdiction_code
  );
}

function qualificationStatus(
  qualification: QualificationRow,
  nowMs: number
): "ok" | "review" | "blocked" {
  if (qualification.valid_from) {
    const validFrom = Date.parse(qualification.valid_from);
    if (Number.isFinite(validFrom) && validFrom > nowMs) return "review";
  }

  if (qualification.valid_until) {
    const validUntil = Date.parse(qualification.valid_until);
    if (Number.isFinite(validUntil) && validUntil <= nowMs) return "blocked";
  }

  const status = qualification.status.trim().toLowerCase();
  if (
    ["approved", "verified", "active", "satisfied", "granted"].includes(status)
  ) {
    return "ok";
  }
  if (
    ["rejected", "revoked", "expired", "suspended", "blocked", "denied", "failed"].includes(
      status
    )
  ) {
    return "blocked";
  }
  return "review";
}

function selectTrustDecision(
  decisions: TrustDecisionRow[],
  input: {
    subjectType: string;
    subjectId: string;
    activityKey: string;
    userServiceId?: string | null;
  }
): TrustDecisionRow | null {
  const exact = decisions.filter(
    (row) =>
      row.target_type === input.subjectType &&
      row.target_ref === input.subjectId
  );
  if (exact.length > 0) return exact[0];

  const service = decisions.filter(
    (row) =>
      row.target_type === "service" &&
      (row.target_ref === input.userServiceId ||
        row.target_ref === input.activityKey)
  );
  if (service.length > 0) return service[0];

  const category = decisions.filter(
    (row) =>
      row.target_type === "category" &&
      (!row.target_ref || row.target_ref === input.activityKey)
  );
  if (category.length > 0) return category[0];

  return null;
}

function stripeTransferCapabilityStatus(capabilities: unknown): string | null {
  const root = asRecord(capabilities);
  const direct = root.transfers ?? root.stripe_transfers;

  if (typeof direct === "string") return direct.toLowerCase();

  const directRecord = asRecord(direct);
  if (typeof directRecord.status === "string") {
    return directRecord.status.toLowerCase();
  }

  const nested = asRecord(
    asRecord(asRecord(root.stripe_balance).stripe_transfers)
  );
  return typeof nested.status === "string"
    ? nested.status.toLowerCase()
    : null;
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
  if (!data?.id) throw new Error("KLYX_ECONOMIC_SETTLEMENT_DECISION_NOT_RECORDED");
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

  const providerProfileId =
    String(booking.provider_id ?? booking.babysitter_id ?? "").trim();

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
  const nowMs = evaluatedAt.getTime();
  const activityKey = normalizeActivityKey(input.activityKey);
  const jurisdictionCode = normalizeJurisdictionCode(input.jurisdictionCode);
  const blocked: string[] = [];
  const review: string[] = [];

  const identity = await ensureEconomicIdentity(input.accountId);

  const [
    capabilityResult,
    qualificationResult,
    canonicalStripeResult,
    trustRestrictionsResult,
    trustDecisionsResult,
    verificationResult,
    economicRestrictionsResult,
    stripeProjectionResult,
  ] = await Promise.all([
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
      .from("economic_verification_cases")
      .select("id, verification_type, status, human_review_required")
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
        "economic_identity_id, account_id, stripe_account_id, details_submitted, payouts_enabled, currently_due, eventually_due, past_due, pending_verification, requirement_errors, disabled_reason, capabilities, provider_observed_at"
      )
      .eq("economic_identity_id", identity.id)
      .maybeSingle(),
  ]);

  for (const result of [
    capabilityResult,
    qualificationResult,
    canonicalStripeResult,
    trustRestrictionsResult,
    trustDecisionsResult,
    verificationResult,
    economicRestrictionsResult,
    stripeProjectionResult,
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
  const verificationCases =
    (verificationResult.data ?? []) as VerificationCaseRow[];
  const economicRestrictions =
    (economicRestrictionsResult.data ?? []) as EconomicRestrictionRow[];
  const stripeProjection =
    (stripeProjectionResult.data as StripeProjectionRow | null) ?? null;

  if (capability?.enabled !== true) {
    blocked.push("ACCOUNT_OFFER_SERVICES_CAPABILITY_DENIED");
  }

  if (identity.status === "closed" || identity.status === "restricted") {
    blocked.push("ECONOMIC_IDENTITY_RESTRICTED");
  }
  if (identity.status === "human_review" || identity.human_review_required) {
    review.push(
      identity.review_reason_code || "ECONOMIC_IDENTITY_HUMAN_REVIEW_REQUIRED"
    );
  }

  for (const verification of verificationCases) {
    if (
      verification.status === "human_review" ||
      verification.human_review_required
    ) {
      review.push("ECONOMIC_VERIFICATION_HUMAN_REVIEW_REQUIRED");
      continue;
    }

    if (
      [
        "required",
        "pending",
        "pending_external_review",
        "failed",
        "expired",
        "restricted",
      ].includes(verification.status)
    ) {
      blocked.push("ECONOMIC_VERIFICATION_NOT_SATISFIED");
    }
  }

  const applicableQualifications = qualifications.filter((qualification) =>
    qualificationApplies(qualification, {
      activityKey,
      jurisdictionCode,
      userServiceId: input.userServiceId,
    })
  );

  for (const qualification of applicableQualifications) {
    const status = qualificationStatus(qualification, nowMs);
    if (status === "blocked") {
      blocked.push("ACCOUNT_QUALIFICATION_CONTRADICTION");
    } else if (status === "review") {
      review.push("ACCOUNT_QUALIFICATION_REVIEW_REQUIRED");
    }
  }

  const applicableEconomicRestrictions = economicRestrictions.filter(
    (restriction) =>
      economicRestrictionApplies(
        restriction,
        activityKey,
        jurisdictionCode,
        nowMs
      )
  );

  for (const restriction of applicableEconomicRestrictions) {
    if (restriction.human_review_required) {
      review.push("ECONOMIC_RESTRICTION_HUMAN_REVIEW_REQUIRED");
    } else {
      blocked.push("ECONOMIC_RESTRICTION_ACTIVE");
    }
  }

  const applicableTrustRestrictions = trustRestrictions.filter((restriction) =>
    trustRestrictionApplies(
      restriction,
      {
        activityKey,
        userServiceId: input.userServiceId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
      nowMs
    )
  );

  for (const restriction of applicableTrustRestrictions) {
    if (restriction.human_review_required) {
      review.push("TRUST_RESTRICTION_HUMAN_REVIEW_REQUIRED");
    } else {
      blocked.push("TRUST_RESTRICTION_ACTIVE");
    }
  }

  const trustDecision = selectTrustDecision(trustDecisions, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    activityKey,
    userServiceId: input.userServiceId,
  });

  if (!trustDecision) {
    review.push("TRUST_ACTIVITY_ELIGIBILITY_MISSING");
  } else {
    const expired =
      Boolean(trustDecision.expires_at) &&
      Date.parse(trustDecision.expires_at as string) <= nowMs;

    if (expired) {
      review.push("TRUST_ACTIVITY_ELIGIBILITY_EXPIRED");
    } else if (
      trustDecision.human_review_required ||
      trustDecision.review_status === "pending"
    ) {
      review.push("TRUST_ACTIVITY_ELIGIBILITY_HUMAN_REVIEW_REQUIRED");
    } else if (
      trustDecision.review_status === "rejected" ||
      ["requirements_missing", "ineligible"].includes(trustDecision.decision)
    ) {
      blocked.push("TRUST_ACTIVITY_ELIGIBILITY_DENIED");
    } else if (trustDecision.decision === "human_review_required") {
      review.push("TRUST_ACTIVITY_ELIGIBILITY_HUMAN_REVIEW_REQUIRED");
    } else if (trustDecision.decision === "eligible_with_conditions") {
      if (asArray(trustDecision.required_actions).length > 0) {
        review.push("TRUST_ACTIVITY_ELIGIBILITY_CONDITIONS_OUTSTANDING");
      }
    } else if (trustDecision.decision !== "eligible") {
      review.push("TRUST_ACTIVITY_ELIGIBILITY_UNKNOWN");
    }
  }

  let stripeAccountId: string | null = null;

  if (
    !canonicalStripe ||
    canonicalStripe.identity_state !== "linked" ||
    !canonicalStripe.stripe_account_id
  ) {
    review.push("CANONICAL_STRIPE_IDENTITY_NOT_LINKED");
  } else {
    stripeAccountId = canonicalStripe.stripe_account_id;

    if (stripeAccountId !== input.expectedStripeAccountId) {
      review.push("CANONICAL_STRIPE_IDENTITY_CHANGED");
    }
  }

  let transferCapabilityStatus: string | null = null;

  if (!stripeProjection) {
    review.push("ECONOMIC_STRIPE_PROJECTION_MISSING");
  } else if (
    stripeProjection.account_id !== input.accountId ||
    stripeProjection.economic_identity_id !== identity.id ||
    stripeProjection.stripe_account_id !== stripeAccountId ||
    stripeProjection.stripe_account_id !== input.expectedStripeAccountId
  ) {
    review.push("ECONOMIC_STRIPE_PROJECTION_DIVERGED");
  } else {
    transferCapabilityStatus = stripeTransferCapabilityStatus(
      stripeProjection.capabilities
    );

    if (!stripeProjection.details_submitted) {
      blocked.push("STRIPE_DETAILS_NOT_SUBMITTED");
    }
    if (!stripeProjection.payouts_enabled) {
      blocked.push("STRIPE_PAYOUTS_NOT_ENABLED");
    }
    if (asArray(stripeProjection.currently_due).length > 0) {
      blocked.push("STRIPE_REQUIREMENTS_CURRENTLY_DUE");
    }
    if (asArray(stripeProjection.past_due).length > 0) {
      blocked.push("STRIPE_REQUIREMENTS_PAST_DUE");
    }
    if (asArray(stripeProjection.pending_verification).length > 0) {
      blocked.push("STRIPE_REQUIREMENTS_PENDING_VERIFICATION");
    }
    if (asArray(stripeProjection.requirement_errors).length > 0) {
      blocked.push("STRIPE_REQUIREMENT_ERRORS");
    }
    if (stripeProjection.disabled_reason?.trim()) {
      blocked.push("STRIPE_ACCOUNT_DISABLED");
    }
    if (
      transferCapabilityStatus &&
      !["active", "enabled"].includes(transferCapabilityStatus)
    ) {
      blocked.push("STRIPE_TRANSFER_CAPABILITY_INACTIVE");
    }
  }

  const reasonCodes = Array.from(
    new Set(blocked.length > 0 ? [...blocked, ...review] : review)
  );

  const decision: EconomicSettlementEligibilityDecision =
    blocked.length > 0
      ? "blocked"
      : review.length > 0
        ? "human_review"
        : "allowed";

  const sourceTrustDecisionId = trustDecision?.id ?? null;
  const decisionId = await recordDecision({
    accountId: input.accountId,
    economicIdentityId: identity.id,
    sourceTrustDecisionId,
    stripeAccountId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    activityKey,
    jurisdictionCode,
    decision,
    reasonCodes,
    evidenceSnapshot: {
      accountCapabilityEnabled: capability?.enabled === true,
      economicIdentityStatus: identity.status,
      verificationCaseIds: verificationCases.map((row) => row.id),
      applicableQualificationIds: applicableQualifications.map((row) => row.id),
      economicRestrictionIds: applicableEconomicRestrictions.map((row) => row.id),
      trustRestrictionIds: applicableTrustRestrictions.map((row) => row.id),
      trustDecisionId: sourceTrustDecisionId,
      stripeProjectionPresent: Boolean(stripeProjection),
      stripeProjectionDetailsSubmitted:
        stripeProjection?.details_submitted ?? false,
      stripeProjectionPayoutsEnabled:
        stripeProjection?.payouts_enabled ?? false,
      stripeCurrentlyDueCount: asArray(stripeProjection?.currently_due).length,
      stripeEventuallyDueCount: asArray(stripeProjection?.eventually_due).length,
      stripePastDueCount: asArray(stripeProjection?.past_due).length,
      stripePendingVerificationCount: asArray(
        stripeProjection?.pending_verification
      ).length,
      stripeRequirementErrorCount: asArray(
        stripeProjection?.requirement_errors
      ).length,
      stripeTransferCapabilityStatus: transferCapabilityStatus,
    },
    evaluatedAt,
  });

  return {
    decisionId,
    decision,
    reasonCodes,
    sourceTrustDecisionId,
    stripeAccountId,
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
