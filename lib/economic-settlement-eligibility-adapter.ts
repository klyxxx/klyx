import {
  evaluateEconomicEligibility,
  type CountryEligibilityStatus,
  type EconomicEligibilityDecision,
  type EconomicEligibilityResult,
  type EconomicEligibilityState,
  type ExternalPaymentProviderRequirement,
  type ExternalProviderStatus,
  type KlyxAuthorityStatus,
  type PreviousEconomicEligibilityState,
} from "@/lib/economic-eligibility-engine";

export type EconomicIdentitySource = {
  id: string;
  status: string;
  humanReviewRequired: boolean;
  reviewReasonCode: string | null;
};

export type LegalSubjectSource = {
  id: string;
  kind: "person" | "entity";
  isPrimary: boolean;
  verificationStatus: string;
  expiresAt: string | null;
};

export type VerificationSource = {
  id: string;
  verificationType: string;
  status: string;
  humanReviewRequired: boolean;
  legalEntityId: string | null;
  economicPersonId: string | null;
  expiresAt: string | null;
};

export type QualificationSource = {
  id: string;
  qualificationKey: string;
  scopeType: string;
  scopeKey: string;
  activityKey: string | null;
  jurisdictionCode: string | null;
  status: string;
  validFrom: string | null;
  validUntil: string | null;
};

export type EconomicRestrictionSource = {
  id: string;
  restrictedAction: string;
  scopeType: string;
  activityKey: string | null;
  jurisdictionCode: string | null;
  status: string;
  reasonCode: string;
  humanReviewRequired: boolean;
  startsAt: string;
  endsAt: string | null;
};

export type TrustRestrictionSource = {
  id: string;
  scopeType: string;
  scopeKey: string | null;
  restrictedAction: string;
  status: string;
  humanReviewRequired: boolean;
  startsAt: string;
  endsAt: string | null;
  reasonCode: string;
};

export type TrustDecisionSource = {
  id: string;
  targetType: string;
  targetRef: string | null;
  decision: string;
  humanReviewRequired: boolean;
  reviewStatus: string;
  reasonCodes: unknown;
  requiredActions: unknown;
  createdAt: string;
  expiresAt: string | null;
};

export type CanonicalExternalIdentitySource = {
  identityState: string;
  externalAccountRef: string | null;
} | null;

export type ExternalProviderProjectionSource = {
  economicIdentityId: string;
  accountId: string;
  externalAccountRef: string;
  payoutsEnabled: boolean;
  currentlyDue: unknown;
  pastDue: unknown;
  pendingVerification: unknown;
  requirementErrors: unknown;
  disabledReason: string | null;
  capabilities: unknown;
} | null;

export type SettlementEligibilitySourceSnapshot = {
  accountId: string;
  accountExists: boolean;
  offerServicesEnabled: boolean;
  economicIdentity: EconomicIdentitySource;
  legalSubjects: readonly LegalSubjectSource[];
  verifications: readonly VerificationSource[];
  qualifications: readonly QualificationSource[];
  economicRestrictions: readonly EconomicRestrictionSource[];
  trustRestrictions: readonly TrustRestrictionSource[];
  trustDecisions: readonly TrustDecisionSource[];
  canonicalExternalIdentity: CanonicalExternalIdentitySource;
  externalProviderProjection: ExternalProviderProjectionSource;
  context: {
    activityKey: string;
    jurisdictionCode: string;
    subjectType: string;
    subjectId: string;
    userServiceId?: string | null;
    expectedExternalAccountRef: string;
    evaluatedAt: string;
  };
  previous: PreviousEconomicEligibilityState | null;
};

export type SettlementEligibilityAdapterResult = {
  engineResult: EconomicEligibilityResult;
  decision: EconomicEligibilityDecision;
  reasonCodes: string[];
  sourceTrustDecisionId: string | null;
  externalAccountRef: string | null;
  evidenceSnapshot: Record<string, unknown>;
};

const STATUS_PRIORITY: Readonly<Record<KlyxAuthorityStatus, number>> = {
  verified: 0,
  human_review: 10,
  pending: 20,
  expired: 30,
  restricted: 40,
};

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

function requiredActionCodes(value: unknown): string[] {
  return asArray(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const record = asRecord(item);
      return typeof record.code === "string" ? record.code.trim() : "";
    })
    .filter(Boolean);
}

function normalizeActivityKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeJurisdictionCode(value: string): string {
  return value.trim().toUpperCase();
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

function strongerStatus(
  left: KlyxAuthorityStatus,
  right: KlyxAuthorityStatus
): KlyxAuthorityStatus {
  return STATUS_PRIORITY[right] > STATUS_PRIORITY[left] ? right : left;
}

function normalizeKlyxStatus(value: string): KlyxAuthorityStatus {
  const status = value.trim().toLowerCase();
  if (
    [
      "verified",
      "ready",
      "active",
      "approved",
      "satisfied",
      "granted",
      "eligible",
      "linked",
    ].includes(status)
  ) {
    return "verified";
  }
  if (["human_review", "human_review_required", "review_required"].includes(status)) {
    return "human_review";
  }
  if (
    ["pending", "required", "pending_external_review", "in_review", "processing"].includes(
      status
    )
  ) {
    return "pending";
  }
  if (status === "expired") return "expired";
  if (
    [
      "restricted",
      "closed",
      "rejected",
      "revoked",
      "suspended",
      "blocked",
      "denied",
      "failed",
      "ineligible",
    ].includes(status)
  ) {
    return "restricted";
  }
  return "human_review";
}

function statusWithExpiry(
  rawStatus: string,
  expiresAt: string | null | undefined,
  nowMs: number,
  humanReviewRequired = false
): KlyxAuthorityStatus {
  let status = normalizeKlyxStatus(rawStatus);
  if (humanReviewRequired) status = strongerStatus(status, "human_review");
  if (expiresAt) {
    const expires = Date.parse(expiresAt);
    if (Number.isFinite(expires) && expires <= nowMs) {
      status = strongerStatus(status, "expired");
    }
  }
  return status;
}

function qualificationStatus(
  qualification: QualificationSource,
  nowMs: number
): KlyxAuthorityStatus {
  let status = normalizeKlyxStatus(qualification.status);
  if (qualification.validFrom) {
    const validFrom = Date.parse(qualification.validFrom);
    if (Number.isFinite(validFrom) && validFrom > nowMs) {
      status = strongerStatus(status, "pending");
    }
  }
  if (qualification.validUntil) {
    const validUntil = Date.parse(qualification.validUntil);
    if (Number.isFinite(validUntil) && validUntil <= nowMs) {
      status = strongerStatus(status, "expired");
    }
  }
  return status;
}

function economicRestrictionApplies(
  restriction: EconomicRestrictionSource,
  activityKey: string,
  jurisdictionCode: string,
  nowMs: number
): boolean {
  if (
    restriction.status !== "active" ||
    !activeWindow(restriction.startsAt, restriction.endsAt, nowMs)
  ) {
    return false;
  }
  if (
    ![
      "receive_settlement",
      "settlement_release",
      "receive_payouts",
      "use_platform",
    ].includes(restriction.restrictedAction)
  ) {
    return false;
  }
  switch (restriction.scopeType) {
    case "global":
      return true;
    case "activity":
      return restriction.activityKey === activityKey;
    case "jurisdiction":
      return restriction.jurisdictionCode === jurisdictionCode;
    case "activity_jurisdiction":
      return (
        restriction.activityKey === activityKey &&
        restriction.jurisdictionCode === jurisdictionCode
      );
    default:
      return true;
  }
}

function trustRestrictionApplies(
  restriction: TrustRestrictionSource,
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
    !activeWindow(restriction.startsAt, restriction.endsAt, nowMs)
  ) {
    return false;
  }
  if (!["receive_payouts", "use_platform"].includes(restriction.restrictedAction)) {
    return false;
  }
  switch (restriction.scopeType) {
    case "platform":
      return true;
    case "category":
      return restriction.scopeKey === input.activityKey;
    case "service":
      return Boolean(
        restriction.scopeKey &&
          (restriction.scopeKey === input.userServiceId ||
            restriction.scopeKey === input.activityKey)
      );
    case "booking":
      return (
        input.subjectType === "booking" &&
        restriction.scopeKey === input.subjectId
      );
    default:
      return true;
  }
}

function qualificationApplies(
  qualification: QualificationSource,
  input: {
    activityKey: string;
    jurisdictionCode: string;
    userServiceId?: string | null;
  }
): boolean {
  if (
    qualification.activityKey &&
    normalizeActivityKey(qualification.activityKey) !== input.activityKey
  ) {
    return false;
  }
  if (
    qualification.jurisdictionCode &&
    normalizeJurisdictionCode(qualification.jurisdictionCode) !== input.jurisdictionCode
  ) {
    return false;
  }
  if (qualification.scopeType === "global") return true;
  if (qualification.scopeType === "user_service") {
    return Boolean(input.userServiceId && qualification.scopeKey === input.userServiceId);
  }
  if (["activity", "category", "service"].includes(qualification.scopeType)) {
    return (
      qualification.scopeKey === input.activityKey ||
      qualification.scopeKey === input.userServiceId
    );
  }
  return Boolean(qualification.activityKey || qualification.jurisdictionCode);
}

export function trustDecisionRequiresQualification(
  decision: TrustDecisionSource | null
): boolean {
  if (!decision) return false;
  return [
    ...strings(decision.reasonCodes),
    ...requiredActionCodes(decision.requiredActions),
  ].some((value) =>
    /(qualification|credential|licen[cs]e|certification|professional[_ -]?proof)/i.test(
      value
    )
  );
}

function selectTrustDecision(
  decisions: readonly TrustDecisionSource[],
  input: {
    subjectType: string;
    subjectId: string;
    activityKey: string;
    userServiceId?: string | null;
  }
): TrustDecisionSource | null {
  const ordered = decisions
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    ordered.find(
      (row) => row.targetType === input.subjectType && row.targetRef === input.subjectId
    ) ??
    ordered.find(
      (row) =>
        row.targetType === "service" &&
        (row.targetRef === input.userServiceId || row.targetRef === input.activityKey)
    ) ??
    ordered.find(
      (row) =>
        row.targetType === "category" &&
        (!row.targetRef || row.targetRef === input.activityKey)
    ) ??
    null
  );
}

function trustDecisionStatus(
  decision: TrustDecisionSource | null,
  nowMs: number
): KlyxAuthorityStatus {
  if (!decision) return "human_review";
  if (decision.expiresAt) {
    const expiresAt = Date.parse(decision.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return "human_review";
  }
  if (decision.humanReviewRequired || decision.reviewStatus === "pending") {
    return "human_review";
  }
  if (
    decision.reviewStatus === "rejected" ||
    ["requirements_missing", "ineligible"].includes(decision.decision)
  ) {
    return "restricted";
  }
  if (decision.decision === "human_review_required") return "human_review";
  if (decision.decision === "eligible_with_conditions") {
    return asArray(decision.requiredActions).length > 0 ? "human_review" : "verified";
  }
  return decision.decision === "eligible" ? "verified" : "human_review";
}

function transferCapabilityStatus(capabilities: unknown): string | null {
  const root = asRecord(capabilities);
  const direct = root.transfers ?? root.stripe_transfers;
  if (typeof direct === "string") return direct.toLowerCase();
  const directRecord = asRecord(direct);
  if (typeof directRecord.status === "string") return directRecord.status.toLowerCase();
  const nested = asRecord(asRecord(asRecord(root.stripe_balance).stripe_transfers));
  return typeof nested.status === "string" ? nested.status.toLowerCase() : null;
}

function primaryLegalSubject(
  subjects: readonly LegalSubjectSource[],
  verifications: readonly VerificationSource[],
  identityId: string,
  nowMs: number
): { id: string; kind: "person" | "entity"; status: KlyxAuthorityStatus } {
  const primary = subjects.filter((subject) => subject.isPrimary);
  if (primary.length === 0) {
    return { id: `missing:${identityId}`, kind: "person", status: "pending" };
  }

  const referenced = primary.find((subject) =>
    verifications.some(
      (verification) =>
        verification.economicPersonId === subject.id ||
        verification.legalEntityId === subject.id
    )
  );
  const selected = referenced ?? primary.slice().sort((a, b) => a.id.localeCompare(b.id))[0];
  const aggregateStatus = primary.reduce<KlyxAuthorityStatus>((current, subject) => {
    return strongerStatus(
      current,
      statusWithExpiry(subject.verificationStatus, subject.expiresAt, nowMs)
    );
  }, "verified");

  return { id: selected.id, kind: selected.kind, status: aggregateStatus };
}

function externalRequirements(
  projection: NonNullable<ExternalProviderProjectionSource>,
  transferActive: boolean
): ExternalPaymentProviderRequirement[] {
  if (transferActive) return [];
  const requirements: ExternalPaymentProviderRequirement[] = [];
  if (asArray(projection.currentlyDue).length > 0) {
    requirements.push({ code: "stripe_currently_due", scope: "settlement" });
  }
  if (asArray(projection.pastDue).length > 0) {
    requirements.push({ code: "stripe_past_due", scope: "settlement" });
  }
  if (asArray(projection.pendingVerification).length > 0) {
    requirements.push({ code: "stripe_pending_verification", scope: "settlement" });
  }
  if (asArray(projection.requirementErrors).length > 0) {
    requirements.push({ code: "stripe_requirement_errors", scope: "settlement" });
  }
  return requirements;
}

function legacyReasonCodes(input: {
  snapshot: SettlementEligibilitySourceSnapshot;
  engineResult: EconomicEligibilityResult;
  trustDecision: TrustDecisionSource | null;
  primaryLegalSubjectMissing: boolean;
  applicableEconomicRestrictions: readonly EconomicRestrictionSource[];
  applicableTrustRestrictions: readonly TrustRestrictionSource[];
  transferActive: boolean;
  providerProjectionValid: boolean;
}): string[] {
  if (input.engineResult.decision === "allowed") return [];

  const aliases: string[] = [];
  const engineCodes = new Set(input.engineResult.reasonCodes);
  const push = (code: string) => {
    if (!aliases.includes(code)) aliases.push(code);
  };

  if (engineCodes.has("ACCOUNT_RESTRICTED")) {
    push("ACCOUNT_OFFER_SERVICES_CAPABILITY_DENIED");
  }
  if (input.primaryLegalSubjectMissing) push("ECONOMIC_LEGAL_SUBJECT_MISSING");
  if (engineCodes.has("LEGAL_SUBJECT_PENDING")) push("ECONOMIC_LEGAL_SUBJECT_NOT_VERIFIED");
  if (engineCodes.has("LEGAL_SUBJECT_EXPIRED")) push("ECONOMIC_LEGAL_SUBJECT_EXPIRED");
  if (engineCodes.has("LEGAL_SUBJECT_RESTRICTED")) {
    push("ECONOMIC_LEGAL_SUBJECT_RESTRICTED");
    push("ECONOMIC_LEGAL_SUBJECT_NOT_VERIFIED");
  }
  if (engineCodes.has("LEGAL_SUBJECT_HUMAN_REVIEW")) {
    push("ECONOMIC_LEGAL_SUBJECT_HUMAN_REVIEW_REQUIRED");
  }

  if (engineCodes.has("VERIFICATION_MISSING")) push("ECONOMIC_VERIFICATION_MISSING");
  if (
    engineCodes.has("VERIFICATION_PENDING") ||
    engineCodes.has("VERIFICATION_EXPIRED") ||
    engineCodes.has("VERIFICATION_RESTRICTED")
  ) {
    push("ECONOMIC_VERIFICATION_NOT_SATISFIED");
  }
  if (engineCodes.has("VERIFICATION_HUMAN_REVIEW")) {
    push("ECONOMIC_VERIFICATION_HUMAN_REVIEW_REQUIRED");
  }

  if (engineCodes.has("QUALIFICATION_MISSING")) push("ACCOUNT_QUALIFICATION_MISSING");
  if (
    engineCodes.has("QUALIFICATION_EXPIRED") ||
    engineCodes.has("QUALIFICATION_RESTRICTED")
  ) {
    push("ACCOUNT_QUALIFICATION_CONTRADICTION");
  }
  if (
    engineCodes.has("QUALIFICATION_PENDING") ||
    engineCodes.has("QUALIFICATION_HUMAN_REVIEW")
  ) {
    push("ACCOUNT_QUALIFICATION_REVIEW_REQUIRED");
  }

  const blockingEconomicRestrictions = input.applicableEconomicRestrictions.filter(
    (restriction) => !restriction.humanReviewRequired
  );
  const reviewEconomicRestrictions = input.applicableEconomicRestrictions.filter(
    (restriction) => restriction.humanReviewRequired
  );
  if (blockingEconomicRestrictions.length > 0) push("ECONOMIC_RESTRICTION_ACTIVE");
  if (reviewEconomicRestrictions.length > 0) {
    push("ECONOMIC_RESTRICTION_HUMAN_REVIEW_REQUIRED");
  }
  if (
    blockingEconomicRestrictions.some((restriction) =>
      ["jurisdiction", "activity_jurisdiction"].includes(restriction.scopeType)
    )
  ) {
    push("ECONOMIC_COUNTRY_RESTRICTED");
  }

  if (input.applicableTrustRestrictions.some((restriction) => !restriction.humanReviewRequired)) {
    push("TRUST_RESTRICTION_ACTIVE");
  }
  if (input.applicableTrustRestrictions.some((restriction) => restriction.humanReviewRequired)) {
    push("TRUST_RESTRICTION_HUMAN_REVIEW_REQUIRED");
  }

  if (!input.trustDecision) {
    push("TRUST_ACTIVITY_ELIGIBILITY_MISSING");
  } else {
    const nowMs = Date.parse(input.snapshot.context.evaluatedAt);
    const expired =
      Boolean(input.trustDecision.expiresAt) &&
      Date.parse(input.trustDecision.expiresAt as string) <= nowMs;
    if (expired) push("TRUST_ACTIVITY_ELIGIBILITY_EXPIRED");
    else if (
      input.trustDecision.humanReviewRequired ||
      input.trustDecision.reviewStatus === "pending" ||
      input.trustDecision.decision === "human_review_required"
    ) {
      push("TRUST_ACTIVITY_ELIGIBILITY_HUMAN_REVIEW_REQUIRED");
    } else if (
      input.trustDecision.reviewStatus === "rejected" ||
      ["requirements_missing", "ineligible"].includes(input.trustDecision.decision)
    ) {
      push("TRUST_ACTIVITY_ELIGIBILITY_DENIED");
    } else if (
      input.trustDecision.decision === "eligible_with_conditions" &&
      asArray(input.trustDecision.requiredActions).length > 0
    ) {
      push("TRUST_ACTIVITY_ELIGIBILITY_CONDITIONS_OUTSTANDING");
    } else if (input.trustDecision.decision !== "eligible") {
      push("TRUST_ACTIVITY_ELIGIBILITY_UNKNOWN");
    }
  }

  const canonical = input.snapshot.canonicalExternalIdentity;
  if (!canonical || canonical.identityState !== "linked" || !canonical.externalAccountRef) {
    push("CANONICAL_STRIPE_IDENTITY_NOT_LINKED");
  } else if (
    canonical.externalAccountRef !== input.snapshot.context.expectedExternalAccountRef
  ) {
    push("CANONICAL_STRIPE_IDENTITY_CHANGED");
  }

  if (!input.snapshot.externalProviderProjection) {
    push("ECONOMIC_STRIPE_PROJECTION_MISSING");
  } else if (!input.providerProjectionValid) {
    push("ECONOMIC_STRIPE_PROJECTION_DIVERGED");
  } else if (!input.transferActive) {
    const projection = input.snapshot.externalProviderProjection;
    if (asArray(projection.currentlyDue).length > 0) {
      push("STRIPE_REQUIREMENTS_CURRENTLY_DUE");
    }
    if (asArray(projection.pastDue).length > 0) push("STRIPE_REQUIREMENTS_PAST_DUE");
    if (asArray(projection.pendingVerification).length > 0) {
      push("STRIPE_REQUIREMENTS_PENDING_VERIFICATION");
    }
    if (asArray(projection.requirementErrors).length > 0) {
      push("STRIPE_REQUIREMENT_ERRORS");
    }
    if (projection.disabledReason?.trim()) push("STRIPE_ACCOUNT_DISABLED");
    push("STRIPE_TRANSFER_CAPABILITY_INACTIVE");
  }

  return [...input.engineResult.reasonCodes, ...aliases].filter(
    (value, index, values) => value !== "ALL_KLYX_AUTHORITIES_VERIFIED" && values.indexOf(value) === index
  );
}

export function evaluateSettlementEligibilitySnapshot(
  snapshot: SettlementEligibilitySourceSnapshot
): SettlementEligibilityAdapterResult {
  const evaluatedAtMs = Date.parse(snapshot.context.evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs)) {
    throw new Error("KLYX_ECONOMIC_ELIGIBILITY_INVALID_EVALUATED_AT");
  }
  const activityKey = normalizeActivityKey(snapshot.context.activityKey);
  const jurisdictionCode = normalizeJurisdictionCode(snapshot.context.jurisdictionCode);

  const trustDecision = selectTrustDecision(snapshot.trustDecisions, {
    subjectType: snapshot.context.subjectType,
    subjectId: snapshot.context.subjectId,
    activityKey,
    userServiceId: snapshot.context.userServiceId,
  });

  const applicableQualifications = snapshot.qualifications.filter((qualification) =>
    qualificationApplies(qualification, {
      activityKey,
      jurisdictionCode,
      userServiceId: snapshot.context.userServiceId,
    })
  );
  const qualificationRequired = trustDecisionRequiresQualification(trustDecision);

  const applicableEconomicRestrictions = snapshot.economicRestrictions.filter((restriction) =>
    economicRestrictionApplies(restriction, activityKey, jurisdictionCode, evaluatedAtMs)
  );
  const applicableTrustRestrictions = snapshot.trustRestrictions.filter((restriction) =>
    trustRestrictionApplies(
      restriction,
      {
        activityKey,
        userServiceId: snapshot.context.userServiceId,
        subjectType: snapshot.context.subjectType,
        subjectId: snapshot.context.subjectId,
      },
      evaluatedAtMs
    )
  );

  const legalSubject = primaryLegalSubject(
    snapshot.legalSubjects,
    snapshot.verifications,
    snapshot.economicIdentity.id,
    evaluatedAtMs
  );
  const primaryLegalSubjectMissing = !snapshot.legalSubjects.some((subject) => subject.isPrimary);

  let identityStatus = statusWithExpiry(
    snapshot.economicIdentity.status,
    null,
    evaluatedAtMs,
    snapshot.economicIdentity.humanReviewRequired
  );
  if (snapshot.economicIdentity.reviewReasonCode && snapshot.economicIdentity.humanReviewRequired) {
    identityStatus = strongerStatus(identityStatus, "human_review");
  }

  let activityStatus = trustDecisionStatus(trustDecision, evaluatedAtMs);
  for (const restriction of applicableEconomicRestrictions) {
    activityStatus = strongerStatus(
      activityStatus,
      restriction.humanReviewRequired ? "human_review" : "restricted"
    );
  }
  for (const restriction of applicableTrustRestrictions) {
    activityStatus = strongerStatus(
      activityStatus,
      restriction.humanReviewRequired ? "human_review" : "restricted"
    );
  }

  let countryStatus: CountryEligibilityStatus = "allowed";
  for (const restriction of applicableEconomicRestrictions) {
    if (!["jurisdiction", "activity_jurisdiction"].includes(restriction.scopeType)) continue;
    if (!restriction.humanReviewRequired) {
      countryStatus = "restricted";
      break;
    }
    if (countryStatus === "allowed") countryStatus = "human_review";
  }

  const canonical = snapshot.canonicalExternalIdentity;
  const externalAccountRef = canonical?.externalAccountRef ?? null;
  const canonicalLinked = Boolean(
    canonical && canonical.identityState === "linked" && externalAccountRef
  );
  const canonicalMatchesExpected =
    canonicalLinked && externalAccountRef === snapshot.context.expectedExternalAccountRef;
  const projection = snapshot.externalProviderProjection;
  const providerProjectionValid = Boolean(
    projection &&
      projection.accountId === snapshot.accountId &&
      projection.economicIdentityId === snapshot.economicIdentity.id &&
      projection.externalAccountRef === externalAccountRef &&
      projection.externalAccountRef === snapshot.context.expectedExternalAccountRef
  );
  const transferStatus = projection ? transferCapabilityStatus(projection.capabilities) : null;
  const transferActive = Boolean(
    providerProjectionValid && transferStatus && ["active", "enabled"].includes(transferStatus)
  );

  let providerStatus: ExternalProviderStatus = "ready";
  let settlementEnabled = transferActive;
  let requirementsDue: ExternalPaymentProviderRequirement[] = [];
  if (!canonicalLinked || !canonicalMatchesExpected || !projection || !providerProjectionValid) {
    providerStatus = "human_review";
    settlementEnabled = Boolean(projection && providerProjectionValid && transferActive);
  } else if (!transferActive) {
    requirementsDue = externalRequirements(projection, false);
    providerStatus = projection.disabledReason?.trim()
      ? "restricted"
      : requirementsDue.length > 0
        ? "pending"
        : "restricted";
  }

  const verificationTypes =
    snapshot.verifications.length > 0
      ? Array.from(
          new Set(
            snapshot.verifications
              .map((verification) => verification.verificationType.trim().toLowerCase())
              .filter(Boolean)
          )
        )
      : ["economic_identity_verification"];

  const qualificationKeys = Array.from(
    new Set(
      applicableQualifications
        .map((qualification) => qualification.qualificationKey.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  if (qualificationRequired && qualificationKeys.length === 0) {
    qualificationKeys.push("required_activity_qualification");
  }

  const engineResult = evaluateEconomicEligibility({
    account: {
      id: snapshot.accountId,
      status:
        snapshot.accountExists && snapshot.offerServicesEnabled ? "active" : "restricted",
    },
    economicIdentity: {
      id: snapshot.economicIdentity.id,
      accountId: snapshot.accountId,
      status: identityStatus,
    },
    legalSubject: {
      id: legalSubject.id,
      economicIdentityId: snapshot.economicIdentity.id,
      kind: legalSubject.kind,
      status: legalSubject.status,
    },
    verifications: snapshot.verifications.map((verification) => ({
      id: verification.id,
      subjectId:
        verification.economicPersonId === legalSubject.id ||
        verification.legalEntityId === legalSubject.id
          ? legalSubject.id
          : legalSubject.id,
      type: verification.verificationType,
      status: statusWithExpiry(
        verification.status,
        verification.expiresAt,
        evaluatedAtMs,
        verification.humanReviewRequired
      ),
    })),
    qualifications: applicableQualifications.map((qualification) => ({
      id: qualification.id,
      accountId: snapshot.accountId,
      key: qualification.qualificationKey,
      status: qualificationStatus(qualification, evaluatedAtMs),
    })),
    activityEligibility: {
      id: trustDecision?.id ?? `missing:${snapshot.context.subjectType}:${snapshot.context.subjectId}`,
      accountId: snapshot.accountId,
      activityKey,
      countryCode: jurisdictionCode,
      status: activityStatus,
      countryStatus,
    },
    externalPaymentProvider: {
      provider: "stripe",
      economicIdentityId: snapshot.economicIdentity.id,
      externalAccountRef,
      status: providerStatus,
      settlementEnabled,
      payoutsEnabled: projection?.payoutsEnabled ?? false,
      requirementsDue,
    },
    requirements: {
      verificationTypes,
      qualificationKeys,
    },
    context: {
      action: "settlement",
      activityKey,
      countryCode: jurisdictionCode,
      evaluatedAt: snapshot.context.evaluatedAt,
    },
    previous: snapshot.previous,
  });

  const reasonCodes = legacyReasonCodes({
    snapshot,
    engineResult,
    trustDecision,
    primaryLegalSubjectMissing,
    applicableEconomicRestrictions,
    applicableTrustRestrictions,
    transferActive,
    providerProjectionValid,
  });

  return {
    engineResult,
    decision: engineResult.decision,
    reasonCodes,
    sourceTrustDecisionId: trustDecision?.id ?? null,
    externalAccountRef,
    evidenceSnapshot: {
      engineState: engineResult.state,
      engineDecision: engineResult.decision,
      engineAuthorized: engineResult.authorized,
      engineReasonCodes: engineResult.reasonCodes,
      engineEvidence: engineResult.evidence,
      engineAuditEvent: engineResult.auditEvent,
      qualificationRequired,
      applicableQualificationIds: applicableQualifications.map((row) => row.id),
      economicRestrictionIds: applicableEconomicRestrictions.map((row) => row.id),
      trustRestrictionIds: applicableTrustRestrictions.map((row) => row.id),
      trustDecisionId: trustDecision?.id ?? null,
      primaryLegalSubjectId: legalSubject.id,
      primaryLegalSubjectMissing,
      verificationCaseIds: snapshot.verifications.map((row) => row.id),
      externalProviderProjectionPresent: Boolean(projection),
      externalProviderProjectionPayoutsEnabled: projection?.payoutsEnabled ?? false,
      externalTransferCapabilityStatus: transferStatus,
      externalTransferCapabilityActive: transferActive,
      externalProviderProjectionValid: providerProjectionValid,
    },
  };
}

export function previousEconomicEligibilityState(input: {
  decision: string;
  evidenceSnapshot: unknown;
} | null): PreviousEconomicEligibilityState | null {
  if (!input) return null;
  const evidence = asRecord(input.evidenceSnapshot);
  const engineState = evidence.engineState;
  const state: EconomicEligibilityState =
    typeof engineState === "string" &&
    [
      "verified",
      "pending",
      "expired",
      "restricted",
      "qualification_missing",
      "country_restricted",
      "payouts_disabled",
      "requirements_due",
      "human_review",
    ].includes(engineState)
      ? (engineState as EconomicEligibilityState)
      : input.decision === "allowed"
        ? "verified"
        : input.decision === "human_review"
          ? "human_review"
          : "restricted";
  const decision: EconomicEligibilityDecision =
    input.decision === "allowed" ||
    input.decision === "human_review" ||
    input.decision === "blocked"
      ? input.decision
      : "blocked";
  return { state, decision };
}
