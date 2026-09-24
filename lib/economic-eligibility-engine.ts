export type EconomicEligibilityState =
  | "verified"
  | "pending"
  | "expired"
  | "restricted"
  | "qualification_missing"
  | "country_restricted"
  | "payouts_disabled"
  | "requirements_due"
  | "human_review";

export type EconomicEligibilityDecision = "allowed" | "blocked" | "human_review";
export type EconomicEligibilityAction = "settlement" | "payout";
export type KlyxAuthorityStatus = "verified" | "pending" | "expired" | "restricted" | "human_review";
export type AccountStatus = "active" | "pending" | "restricted" | "human_review";
export type CountryEligibilityStatus = "allowed" | "pending" | "restricted" | "human_review";
export type ExternalProviderStatus = "ready" | "pending" | "restricted" | "human_review";
export type ExternalRequirementScope = "settlement" | "payout" | "both";

export type EconomicEligibilityAuthority =
  | "account"
  | "economic_identity"
  | "legal_subject"
  | "verification"
  | "qualification"
  | "activity_eligibility"
  | "country_eligibility"
  | "external_payment_provider";

export type EconomicEligibilityReasonCode =
  | "ALL_KLYX_AUTHORITIES_VERIFIED"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_RESTRICTED"
  | "ACCOUNT_HUMAN_REVIEW"
  | "ECONOMIC_IDENTITY_ACCOUNT_MISMATCH"
  | "ECONOMIC_IDENTITY_PENDING"
  | "ECONOMIC_IDENTITY_EXPIRED"
  | "ECONOMIC_IDENTITY_RESTRICTED"
  | "ECONOMIC_IDENTITY_HUMAN_REVIEW"
  | "LEGAL_SUBJECT_IDENTITY_MISMATCH"
  | "LEGAL_SUBJECT_PENDING"
  | "LEGAL_SUBJECT_EXPIRED"
  | "LEGAL_SUBJECT_RESTRICTED"
  | "LEGAL_SUBJECT_HUMAN_REVIEW"
  | "VERIFICATION_MISSING"
  | "VERIFICATION_SUBJECT_MISMATCH"
  | "VERIFICATION_PENDING"
  | "VERIFICATION_EXPIRED"
  | "VERIFICATION_RESTRICTED"
  | "VERIFICATION_HUMAN_REVIEW"
  | "QUALIFICATION_MISSING"
  | "QUALIFICATION_ACCOUNT_MISMATCH"
  | "QUALIFICATION_PENDING"
  | "QUALIFICATION_EXPIRED"
  | "QUALIFICATION_RESTRICTED"
  | "QUALIFICATION_HUMAN_REVIEW"
  | "ACTIVITY_ACCOUNT_MISMATCH"
  | "ACTIVITY_CONTEXT_MISMATCH"
  | "ACTIVITY_PENDING"
  | "ACTIVITY_EXPIRED"
  | "ACTIVITY_RESTRICTED"
  | "ACTIVITY_HUMAN_REVIEW"
  | "COUNTRY_CONTEXT_MISMATCH"
  | "COUNTRY_RESTRICTED"
  | "COUNTRY_PENDING"
  | "COUNTRY_HUMAN_REVIEW"
  | "EXTERNAL_PROVIDER_IDENTITY_MISMATCH"
  | "EXTERNAL_PROVIDER_ACCOUNT_MISSING"
  | "EXTERNAL_PROVIDER_PENDING"
  | "EXTERNAL_PROVIDER_RESTRICTED"
  | "EXTERNAL_PROVIDER_HUMAN_REVIEW"
  | "EXTERNAL_SETTLEMENT_DISABLED"
  | "EXTERNAL_PAYOUTS_DISABLED"
  | "EXTERNAL_REQUIREMENTS_DUE";

export type EconomicEligibilityEvidence = {
  authority: EconomicEligibilityAuthority;
  code: string;
  status: string;
  reference: string | null;
  blocking: boolean;
  details: Readonly<Record<string, string | number | boolean | null>>;
};

export type AccountAuthority = { id: string; status: AccountStatus };
export type EconomicIdentityAuthority = { id: string; accountId: string; status: KlyxAuthorityStatus };
export type LegalSubjectAuthority = {
  id: string;
  economicIdentityId: string;
  kind: "person" | "entity";
  status: KlyxAuthorityStatus;
};
export type VerificationAuthority = {
  id: string;
  subjectId: string;
  type: string;
  status: KlyxAuthorityStatus;
};
export type QualificationAuthority = {
  id: string;
  accountId: string;
  key: string;
  status: KlyxAuthorityStatus;
};
export type ActivityEligibilityAuthority = {
  id: string;
  accountId: string;
  activityKey: string;
  countryCode: string;
  status: KlyxAuthorityStatus;
  countryStatus: CountryEligibilityStatus;
};
export type ExternalPaymentProviderRequirement = {
  code: string;
  scope: ExternalRequirementScope;
};
export type ExternalPaymentProviderState = {
  provider: string;
  economicIdentityId: string;
  externalAccountRef: string | null;
  status: ExternalProviderStatus;
  settlementEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: readonly ExternalPaymentProviderRequirement[];
};
export type EconomicEligibilityRequirements = {
  verificationTypes: readonly string[];
  qualificationKeys: readonly string[];
};
export type EconomicEligibilityContext = {
  action: EconomicEligibilityAction;
  activityKey: string;
  countryCode: string;
  evaluatedAt: string;
};
export type PreviousEconomicEligibilityState = {
  state: EconomicEligibilityState;
  decision: EconomicEligibilityDecision;
};
export type EconomicEligibilityInput = {
  account: AccountAuthority;
  economicIdentity: EconomicIdentityAuthority;
  legalSubject: LegalSubjectAuthority;
  verifications: readonly VerificationAuthority[];
  qualifications: readonly QualificationAuthority[];
  activityEligibility: ActivityEligibilityAuthority;
  externalPaymentProvider: ExternalPaymentProviderState;
  requirements: EconomicEligibilityRequirements;
  context: EconomicEligibilityContext;
  previous?: PreviousEconomicEligibilityState | null;
};
export type EconomicEligibilityAuditEvent = {
  type: "economic_eligibility_evaluated";
  schemaVersion: 1;
  evaluatedAt: string;
  subject: {
    accountId: string;
    economicIdentityId: string;
    legalSubjectId: string;
    activityKey: string;
    countryCode: string;
    action: EconomicEligibilityAction;
  };
  previousState: PreviousEconomicEligibilityState | null;
  newState: {
    state: EconomicEligibilityState;
    decision: EconomicEligibilityDecision;
    authorized: boolean;
  };
  reasonCodes: readonly EconomicEligibilityReasonCode[];
  evidence: readonly EconomicEligibilityEvidence[];
};
export type EconomicEligibilityResult = {
  state: EconomicEligibilityState;
  decision: EconomicEligibilityDecision;
  authorized: boolean;
  reasonCodes: readonly EconomicEligibilityReasonCode[];
  evidence: readonly EconomicEligibilityEvidence[];
  auditEvent: EconomicEligibilityAuditEvent;
};

type Finding = {
  state: EconomicEligibilityState;
  decision: "blocked" | "human_review";
  reasonCode: EconomicEligibilityReasonCode;
};

type MutableEvaluation = {
  findings: Finding[];
  evidence: EconomicEligibilityEvidence[];
};

const STATE_PRIORITY: Readonly<Record<EconomicEligibilityState, number>> = {
  verified: 0,
  human_review: 10,
  pending: 20,
  payouts_disabled: 30,
  requirements_due: 40,
  qualification_missing: 50,
  expired: 60,
  country_restricted: 70,
  restricted: 80,
};

const STATUS_TO_STATE: Readonly<Record<Exclude<KlyxAuthorityStatus, "verified">, EconomicEligibilityState>> = {
  pending: "pending",
  expired: "expired",
  restricted: "restricted",
  human_review: "human_review",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCountry(value: string): string {
  return value.trim().toUpperCase();
}

function pushEvidence(
  evaluation: MutableEvaluation,
  authority: EconomicEligibilityAuthority,
  code: string,
  status: string,
  reference: string | null,
  blocking: boolean,
  details: Readonly<Record<string, string | number | boolean | null>> = {}
): void {
  evaluation.evidence.push({ authority, code, status, reference, blocking, details });
}

function pushFinding(
  evaluation: MutableEvaluation,
  input: {
    state: EconomicEligibilityState;
    decision: "blocked" | "human_review";
    reasonCode: EconomicEligibilityReasonCode;
    authority: EconomicEligibilityAuthority;
    status: string;
    reference: string | null;
    details?: Readonly<Record<string, string | number | boolean | null>>;
  }
): void {
  evaluation.findings.push({
    state: input.state,
    decision: input.decision,
    reasonCode: input.reasonCode,
  });
  pushEvidence(
    evaluation,
    input.authority,
    input.reasonCode,
    input.status,
    input.reference,
    true,
    input.details
  );
}

function evaluateKlyxStatus(
  evaluation: MutableEvaluation,
  input: {
    authority: EconomicEligibilityAuthority;
    reference: string;
    status: KlyxAuthorityStatus;
    prefix: "ECONOMIC_IDENTITY" | "LEGAL_SUBJECT" | "VERIFICATION" | "QUALIFICATION" | "ACTIVITY";
    details?: Readonly<Record<string, string | number | boolean | null>>;
  }
): void {
  if (input.status === "verified") {
    pushEvidence(
      evaluation,
      input.authority,
      `${input.prefix}_VERIFIED`,
      "verified",
      input.reference,
      false,
      input.details
    );
    return;
  }

  const reasonCode = `${input.prefix}_${input.status.toUpperCase()}` as EconomicEligibilityReasonCode;
  pushFinding(evaluation, {
    state: STATUS_TO_STATE[input.status],
    decision: input.status === "human_review" ? "human_review" : "blocked",
    reasonCode,
    authority: input.authority,
    status: input.status,
    reference: input.reference,
    details: input.details,
  });
}

function sortedUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalizeKey).filter(Boolean))).sort();
}

function finalState(findings: readonly Finding[]): EconomicEligibilityState {
  return findings.reduce<EconomicEligibilityState>(
    (current, finding) =>
      STATE_PRIORITY[finding.state] > STATE_PRIORITY[current]
        ? finding.state
        : current,
    "verified"
  );
}

function finalDecision(findings: readonly Finding[]): EconomicEligibilityDecision {
  if (findings.some((finding) => finding.decision === "blocked")) return "blocked";
  if (findings.some((finding) => finding.decision === "human_review")) return "human_review";
  return "allowed";
}

function reasonCodes(
  findings: readonly Finding[],
  decision: EconomicEligibilityDecision
): EconomicEligibilityReasonCode[] {
  if (decision === "allowed") return ["ALL_KLYX_AUTHORITIES_VERIFIED"];

  const seen = new Set<EconomicEligibilityReasonCode>();
  const result: EconomicEligibilityReasonCode[] = [];
  for (const finding of findings) {
    if (!seen.has(finding.reasonCode)) {
      seen.add(finding.reasonCode);
      result.push(finding.reasonCode);
    }
  }
  return result;
}

function requirementApplies(
  requirement: ExternalPaymentProviderRequirement,
  action: EconomicEligibilityAction
): boolean {
  return requirement.scope === "both" || requirement.scope === action;
}

export function evaluateEconomicEligibility(
  input: EconomicEligibilityInput
): EconomicEligibilityResult {
  const evaluation: MutableEvaluation = { findings: [], evidence: [] };
  const activityKey = normalizeKey(input.context.activityKey);
  const countryCode = normalizeCountry(input.context.countryCode);

  if (input.account.status === "active") {
    pushEvidence(evaluation, "account", "ACCOUNT_ACTIVE", "active", input.account.id, false);
  } else if (input.account.status === "human_review") {
    pushFinding(evaluation, {
      state: "human_review",
      decision: "human_review",
      reasonCode: "ACCOUNT_HUMAN_REVIEW",
      authority: "account",
      status: input.account.status,
      reference: input.account.id,
    });
  } else {
    pushFinding(evaluation, {
      state: input.account.status === "pending" ? "pending" : "restricted",
      decision: "blocked",
      reasonCode: input.account.status === "pending" ? "ACCOUNT_PENDING" : "ACCOUNT_RESTRICTED",
      authority: "account",
      status: input.account.status,
      reference: input.account.id,
    });
  }

  if (input.economicIdentity.accountId !== input.account.id) {
    pushFinding(evaluation, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "ECONOMIC_IDENTITY_ACCOUNT_MISMATCH",
      authority: "economic_identity",
      status: "mismatch",
      reference: input.economicIdentity.id,
      details: { expectedAccountId: input.account.id },
    });
  }
  evaluateKlyxStatus(evaluation, {
    authority: "economic_identity",
    reference: input.economicIdentity.id,
    status: input.economicIdentity.status,
    prefix: "ECONOMIC_IDENTITY",
  });

  if (input.legalSubject.economicIdentityId !== input.economicIdentity.id) {
    pushFinding(evaluation, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "LEGAL_SUBJECT_IDENTITY_MISMATCH",
      authority: "legal_subject",
      status: "mismatch",
      reference: input.legalSubject.id,
      details: { expectedEconomicIdentityId: input.economicIdentity.id },
    });
  }
  evaluateKlyxStatus(evaluation, {
    authority: "legal_subject",
    reference: input.legalSubject.id,
    status: input.legalSubject.status,
    prefix: "LEGAL_SUBJECT",
    details: { kind: input.legalSubject.kind },
  });

  for (const type of sortedUnique(input.requirements.verificationTypes)) {
    const matches = input.verifications
      .filter((verification) => normalizeKey(verification.type) === type)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));

    if (matches.length === 0) {
      pushFinding(evaluation, {
        state: "pending",
        decision: "blocked",
        reasonCode: "VERIFICATION_MISSING",
        authority: "verification",
        status: "missing",
        reference: null,
        details: { verificationType: type },
      });
      continue;
    }

    for (const verification of matches) {
      if (verification.subjectId !== input.legalSubject.id) {
        pushFinding(evaluation, {
          state: "restricted",
          decision: "blocked",
          reasonCode: "VERIFICATION_SUBJECT_MISMATCH",
          authority: "verification",
          status: "mismatch",
          reference: verification.id,
          details: {
            verificationType: type,
            expectedSubjectId: input.legalSubject.id,
          },
        });
      }
      evaluateKlyxStatus(evaluation, {
        authority: "verification",
        reference: verification.id,
        status: verification.status,
        prefix: "VERIFICATION",
        details: { verificationType: type },
      });
    }
  }

  for (const key of sortedUnique(input.requirements.qualificationKeys)) {
    const matches = input.qualifications
      .filter((qualification) => normalizeKey(qualification.key) === key)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));

    if (matches.length === 0) {
      pushFinding(evaluation, {
        state: "qualification_missing",
        decision: "blocked",
        reasonCode: "QUALIFICATION_MISSING",
        authority: "qualification",
        status: "missing",
        reference: null,
        details: { qualificationKey: key },
      });
      continue;
    }

    for (const qualification of matches) {
      if (qualification.accountId !== input.account.id) {
        pushFinding(evaluation, {
          state: "restricted",
          decision: "blocked",
          reasonCode: "QUALIFICATION_ACCOUNT_MISMATCH",
          authority: "qualification",
          status: "mismatch",
          reference: qualification.id,
          details: {
            qualificationKey: key,
            expectedAccountId: input.account.id,
          },
        });
      }
      evaluateKlyxStatus(evaluation, {
        authority: "qualification",
        reference: qualification.id,
        status: qualification.status,
        prefix: "QUALIFICATION",
        details: { qualificationKey: key },
      });
    }
  }

  if (input.activityEligibility.accountId !== input.account.id) {
    pushFinding(evaluation, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "ACTIVITY_ACCOUNT_MISMATCH",
      authority: "activity_eligibility",
      status: "mismatch",
      reference: input.activityEligibility.id,
      details: { expectedAccountId: input.account.id },
    });
  }

  const authorityActivityKey = normalizeKey(input.activityEligibility.activityKey);
  if (authorityActivityKey !== activityKey) {
    pushFinding(evaluation, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "ACTIVITY_CONTEXT_MISMATCH",
      authority: "activity_eligibility",
      status: "mismatch",
      reference: input.activityEligibility.id,
      details: { expectedActivityKey: activityKey, authorityActivityKey },
    });
  }
  evaluateKlyxStatus(evaluation, {
    authority: "activity_eligibility",
    reference: input.activityEligibility.id,
    status: input.activityEligibility.status,
    prefix: "ACTIVITY",
    details: { activityKey },
  });

  const authorityCountryCode = normalizeCountry(input.activityEligibility.countryCode);
  if (authorityCountryCode !== countryCode) {
    pushFinding(evaluation, {
      state: "country_restricted",
      decision: "blocked",
      reasonCode: "COUNTRY_CONTEXT_MISMATCH",
      authority: "country_eligibility",
      status: "mismatch",
      reference: input.activityEligibility.id,
      details: { expectedCountryCode: countryCode, authorityCountryCode },
    });
  }

  switch (input.activityEligibility.countryStatus) {
    case "allowed":
      pushEvidence(
        evaluation,
        "country_eligibility",
        "COUNTRY_ALLOWED",
        "allowed",
        input.activityEligibility.id,
        false,
        { countryCode }
      );
      break;
    case "pending":
      pushFinding(evaluation, {
        state: "pending",
        decision: "blocked",
        reasonCode: "COUNTRY_PENDING",
        authority: "country_eligibility",
        status: "pending",
        reference: input.activityEligibility.id,
        details: { countryCode },
      });
      break;
    case "restricted":
      pushFinding(evaluation, {
        state: "country_restricted",
        decision: "blocked",
        reasonCode: "COUNTRY_RESTRICTED",
        authority: "country_eligibility",
        status: "restricted",
        reference: input.activityEligibility.id,
        details: { countryCode },
      });
      break;
    case "human_review":
      pushFinding(evaluation, {
        state: "human_review",
        decision: "human_review",
        reasonCode: "COUNTRY_HUMAN_REVIEW",
        authority: "country_eligibility",
        status: "human_review",
        reference: input.activityEligibility.id,
        details: { countryCode },
      });
      break;
  }

  const provider = input.externalPaymentProvider;
  const providerName = provider.provider.trim();

  if (provider.economicIdentityId !== input.economicIdentity.id) {
    pushFinding(evaluation, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "EXTERNAL_PROVIDER_IDENTITY_MISMATCH",
      authority: "external_payment_provider",
      status: "mismatch",
      reference: provider.externalAccountRef,
      details: { provider: providerName },
    });
  }

  if (!provider.externalAccountRef?.trim()) {
    pushFinding(evaluation, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "EXTERNAL_PROVIDER_ACCOUNT_MISSING",
      authority: "external_payment_provider",
      status: "missing",
      reference: null,
      details: { provider: providerName },
    });
  }

  switch (provider.status) {
    case "ready":
      pushEvidence(
        evaluation,
        "external_payment_provider",
        "EXTERNAL_PROVIDER_READY",
        "ready",
        provider.externalAccountRef,
        false,
        { provider: providerName }
      );
      break;
    case "pending":
      pushFinding(evaluation, {
        state: "pending",
        decision: "blocked",
        reasonCode: "EXTERNAL_PROVIDER_PENDING",
        authority: "external_payment_provider",
        status: "pending",
        reference: provider.externalAccountRef,
        details: { provider: providerName },
      });
      break;
    case "restricted":
      pushFinding(evaluation, {
        state: "restricted",
        decision: "blocked",
        reasonCode: "EXTERNAL_PROVIDER_RESTRICTED",
        authority: "external_payment_provider",
        status: "restricted",
        reference: provider.externalAccountRef,
        details: { provider: providerName },
      });
      break;
    case "human_review":
      pushFinding(evaluation, {
        state: "human_review",
        decision: "human_review",
        reasonCode: "EXTERNAL_PROVIDER_HUMAN_REVIEW",
        authority: "external_payment_provider",
        status: "human_review",
        reference: provider.externalAccountRef,
        details: { provider: providerName },
      });
      break;
  }

  const applicableRequirements = provider.requirementsDue
    .filter((requirement) => requirementApplies(requirement, input.context.action))
    .map((requirement) => requirement.code.trim())
    .filter(Boolean)
    .sort();

  if (applicableRequirements.length > 0) {
    pushFinding(evaluation, {
      state: "requirements_due",
      decision: "blocked",
      reasonCode: "EXTERNAL_REQUIREMENTS_DUE",
      authority: "external_payment_provider",
      status: "requirements_due",
      reference: provider.externalAccountRef,
      details: {
        provider: providerName,
        requirementCount: applicableRequirements.length,
        requirements: applicableRequirements.join(","),
      },
    });
  }

  if (input.context.action === "settlement") {
    if (provider.settlementEnabled) {
      pushEvidence(
        evaluation,
        "external_payment_provider",
        "EXTERNAL_SETTLEMENT_ENABLED",
        "enabled",
        provider.externalAccountRef,
        false,
        { provider: providerName }
      );
    } else {
      pushFinding(evaluation, {
        state: "payouts_disabled",
        decision: "blocked",
        reasonCode: "EXTERNAL_SETTLEMENT_DISABLED",
        authority: "external_payment_provider",
        status: "disabled",
        reference: provider.externalAccountRef,
        details: { provider: providerName },
      });
    }

    pushEvidence(
      evaluation,
      "external_payment_provider",
      "EXTERNAL_PAYOUT_RAIL_STATUS",
      provider.payoutsEnabled ? "enabled" : "disabled",
      provider.externalAccountRef,
      false,
      { provider: providerName, informationalForSettlement: true }
    );
  } else if (provider.payoutsEnabled) {
    pushEvidence(
      evaluation,
      "external_payment_provider",
      "EXTERNAL_PAYOUTS_ENABLED",
      "enabled",
      provider.externalAccountRef,
      false,
      { provider: providerName }
    );
  } else {
    pushFinding(evaluation, {
      state: "payouts_disabled",
      decision: "blocked",
      reasonCode: "EXTERNAL_PAYOUTS_DISABLED",
      authority: "external_payment_provider",
      status: "disabled",
      reference: provider.externalAccountRef,
      details: { provider: providerName },
    });
  }

  const decision = finalDecision(evaluation.findings);
  const state = finalState(evaluation.findings);
  const authorized = decision === "allowed";
  const codes = reasonCodes(evaluation.findings, decision);

  const auditEvent: EconomicEligibilityAuditEvent = {
    type: "economic_eligibility_evaluated",
    schemaVersion: 1,
    evaluatedAt: input.context.evaluatedAt,
    subject: {
      accountId: input.account.id,
      economicIdentityId: input.economicIdentity.id,
      legalSubjectId: input.legalSubject.id,
      activityKey,
      countryCode,
      action: input.context.action,
    },
    previousState: input.previous ?? null,
    newState: { state, decision, authorized },
    reasonCodes: codes,
    evidence: evaluation.evidence,
  };

  return {
    state,
    decision,
    authorized,
    reasonCodes: codes,
    evidence: evaluation.evidence,
    auditEvent,
  };
}

export function settlementIsAuthorized(result: EconomicEligibilityResult): boolean {
  return result.auditEvent.subject.action === "settlement" && result.authorized;
}
