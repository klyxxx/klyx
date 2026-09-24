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

export type EconomicEligibilityDecision =
  | "allowed"
  | "blocked"
  | "human_review";

export type EconomicEligibilityAction = "settlement" | "payout";

export type KlyxAuthorityStatus =
  | "verified"
  | "pending"
  | "expired"
  | "restricted"
  | "human_review";

export type AccountStatus =
  | "active"
  | "pending"
  | "restricted"
  | "human_review";

export type CountryEligibilityStatus =
  | "allowed"
  | "pending"
  | "restricted"
  | "human_review";

export type ExternalProviderStatus =
  | "ready"
  | "pending"
  | "restricted"
  | "human_review";

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

export type AccountAuthority = {
  id: string;
  status: AccountStatus;
};

export type EconomicIdentityAuthority = {
  id: string;
  accountId: string;
  status: KlyxAuthorityStatus;
};

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
  decision: Exclude<EconomicEligibilityDecision, "allowed">;
  reasonCode: EconomicEligibilityReasonCode;
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

function normalizeActivityKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeRequirementKey(value: string): string {
  return value.trim().toLowerCase();
}

function addEvidence(
  evidence: EconomicEligibilityEvidence[],
  authority: EconomicEligibilityAuthority,
  code: string,
  status: string,
  reference: string | null,
  blocking: boolean,
  details: Readonly<Record<string, string | number | boolean | null>> = {}
): void {
  evidence.push({ authority, code, status, reference, blocking, details });
}

function addFinding(
  findings: Finding[],
  evidence: EconomicEligibilityEvidence[],
  input: {
    state: EconomicEligibilityState;
    decision: Exclude<EconomicEligibilityDecision, "allowed">;
    reasonCode: EconomicEligibilityReasonCode;
    authority: EconomicEligibilityAuthority;
    status: string;
    reference: string | null;
    details?: Readonly<Record<string, string | number | boolean | null>>;
  }
): void {
  findings.push({
    state: input.state,
    decision: input.decision,
    reasonCode: input.reasonCode,
  });
  addEvidence(
    evidence,
    input.authority,
    input.reasonCode,
    input.status,
    input.reference,
    true,
    input.details
  );
}

function evaluateStandardStatus(
  findings: Finding[],
  evidence: EconomicEligibilityEvidence[],
  input: {
    authority: EconomicEligibilityAuthority;
    reference: string;
    status: KlyxAuthorityStatus;
    prefix:
      | "ECONOMIC_IDENTITY"
      | "LEGAL_SUBJECT"
      | "VERIFICATION"
      | "QUALIFICATION"
      | "ACTIVITY";
    details?: Readonly<Record<string, string | number | boolean | null>>;
  }
): void {
  if (input.status === "verified") {
    addEvidence(
      evidence,
      input.authority,
      `${input.prefix}_VERIFIED`,
      input.status,
      input.reference,
      false,
      input.details
    );
    return;
  }

  const reasonCode = `${input.prefix}_${input.status.toUpperCase()}` as
    | EconomicEligibilityReasonCode;

  addFinding(findings, evidence, {
    state: input.status === "human_review" ? "human_review" : input.status,
    decision: input.status === "human_review" ? "human_review" : "blocked",
    reasonCode,
    authority: input.authority,
    status: input.status,
    reference: input.reference,
    details: input.details,
  });
}

function requirementApplies(
  requirement: ExternalPaymentProviderRequirement,
  action: EconomicEligibilityAction
): boolean {
  return requirement.scope === "both" || requirement.scope === action;
}

function selectOverallState(findings: readonly Finding[]): EconomicEligibilityState {
  if (findings.length === 0) return "verified";

  return findings.reduce<EconomicEligibilityState>((selected, finding) => {
    return STATE_PRIORITY[finding.state] > STATE_PRIORITY[selected]
      ? finding.state
      : selected;
  }, "verified");
}

function selectDecision(
  findings: readonly Finding[]
): EconomicEligibilityDecision {
  if (findings.some((finding) => finding.decision === "blocked")) {
    return "blocked";
  }
  if (findings.some((finding) => finding.decision === "human_review")) {
    return "human_review";
  }
  return "allowed";
}

function uniqueReasonCodes(
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

export function evaluateEconomicEligibility(
  input: EconomicEligibilityInput
): EconomicEligibilityResult {
  const findings: Finding[] = [];
  const evidence: EconomicEligibilityEvidence[] = [];

  const activityKey = normalizeActivityKey(input.context.activityKey);
  const countryCode = normalizeCountryCode(input.context.countryCode);
  const activityAuthorityKey = normalizeActivityKey(
    input.activityEligibility.activityKey
  );
  const activityAuthorityCountry = normalizeCountryCode(
    input.activityEligibility.countryCode
  );

  if (input.account.status === "active") {
    addEvidence(
      evidence,
      "account",
      "ACCOUNT_ACTIVE",
      "active",
      input.account.id,
      false
    );
  } else if (input.account.status === "human_review") {
    addFinding(findings, evidence, {
      state: "human_review",
      decision: "human_review",
      reasonCode: "ACCOUNT_HUMAN_REVIEW",
      authority: "account",
      status: input.account.status,
      reference: input.account.id,
    });
  } else {
    addFinding(findings, evidence, {
      state: input.account.status === "pending" ? "pending" : "restricted",
      decision: "blocked",
      reasonCode:
        input.account.status === "pending"
          ? "ACCOUNT_PENDING"
          : "ACCOUNT_RESTRICTED",
      authority: "account",
      status: input.account.status,
      reference: input.account.id,
    });
  }

  if (input.economicIdentity.accountId !== input.account.id) {
    addFinding(findings, evidence, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "ECONOMIC_IDENTITY_ACCOUNT_MISMATCH",
      authority: "economic_identity",
      status: "mismatch",
      reference: input.economicIdentity.id,
      details: { expectedAccountId: input.account.id },
    });
  }

  evaluateStandardStatus(findings, evidence, {
    authority: "economic_identity",
    reference: input.economicIdentity.id,
    status: input.economicIdentity.status,
    prefix: "ECONOMIC_IDENTITY",
  });

  if (input.legalSubject.economicIdentityId !== input.economicIdentity.id) {
    addFinding(findings, evidence, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "LEGAL_SUBJECT_IDENTITY_MISMATCH",
      authority: "legal_subject",
      status: "mismatch",
      reference: input.legalSubject.id,
      details: { expectedEconomicIdentityId: input.economicIdentity.id },
    });
  }

  evaluateStandardStatus(findings, evidence, {
    authority: "legal_subject",
    reference: input.legalSubject.id,
    status: input.legalSubject.status,
    prefix: "LEGAL_SUBJECT",
    details: { kind: input.legalSubject.kind },
  });

  const verificationsByType = new Map<string, VerificationAuthority[]>();
  for (const verification of input.verifications) {
    const key = normalizeRequirementKey(verification.type);
    const current = verificationsByType.get(key) ?? [];
    current.push(verification);
    verificationsByType.set(key, current);
  }

  const requiredVerificationTypes = Array.from(
    new Set(
      input.requirements.verificationTypes
        .map(normalizeRequirementKey)
        .filter(Boolean)
    )
  ).sort();

  for (const type of requiredVerificationTypes) {
    const candidates = verificationsByType.get(type) ?? [];
    if (candidates.length === 0) {
      addFinding(findings, evidence, {
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

    const verification = [...candidates].sort((a, b) =>
      a.id.localeCompare(b.id)
    )[0];

    if (verification.subjectId !== input.legalSubject.id) {
      addFinding(findings, evidence, {
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

    evaluateStandardStatus(findings, evidence, {
      authority: "verification",
      reference: verification.id,
      status: verification.status,
      prefix: "VERIFICATION",
      details: { verificationType: type },
    });
  }

  const qualificationsByKey = new Map<string, QualificationAuthority[]>();
  for (const qualification of input.qualifications) {
    const key = normalizeRequirementKey(qualification.key);
    const current = qualificationsByKey.get(key) ?? [];
    current.push(qualification);
    qualificationsByKey.set(key, current);
  }

  const requiredQualificationKeys = Array.from(
    new Set(
      input.requirements.qualificationKeys
        .map(normalizeRequirementKey)
        .filter(Boolean)
    )
  ).sort();

  for (const key of requiredQualificationKeys) {
    const candidates = qualificationsByKey.get(key) ?? [];
    if (candidates.length === 0) {
      addFinding(findings, evidence, {
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

    const qualification = [...candidates].sort((a, b) =>
      a.id.localeCompare(b.id)
    )[0];

    if (qualification.accountId !== input.account.id) {
      addFinding(findings, evidence, {
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

    evaluateStandardStatus(findings, evidence, {
      authority: "qualification",
      reference: qualification.id,
      status: qualification.status,
      prefix: "QUALIFICATION",
      details: { qualificationKey: key },
    });
  }

  if (input.activityEligibility.accountId !== input.account.id) {
    addFinding(findings, evidence, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "ACTIVITY_ACCOUNT_MISMATCH",
      authority: "activity_eligibility",
      status: "mismatch",
      reference: input.activityEligibility.id,
      details: { expectedAccountId: input.account.id },
    });
  }

  if (activityAuthorityKey !== activityKey) {
    addFinding(findings, evidence, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "ACTIVITY_CONTEXT_MISMATCH",
      authority: "activity_eligibility",
      status: "mismatch",
      reference: input.activityEligibility.id,
      details: {
        expectedActivityKey: activityKey,
        authorityActivityKey: activityAuthorityKey,
      },
    });
  }

  evaluateStandardStatus(findings, evidence, {
    authority: "activity_eligibility",
    reference: input.activityEligibility.id,
    status: input.activityEligibility.status,
    prefix: "ACTIVITY",
    details: { activityKey },
  });

  if (activityAuthorityCountry !== countryCode) {
    addFinding(findings, evidence, {
      state: "country_restricted",
      decision: "blocked",
      reasonCode: "COUNTRY_CONTEXT_MISMATCH",
      authority: "country_eligibility",
      status: "mismatch",
      reference: input.activityEligibility.id,
      details: {
        expectedCountryCode: countryCode,
        authorityCountryCode: activityAuthorityCountry,
      },
    });
  }

  if (input.activityEligibility.countryStatus === "allowed") {
    addEvidence(
      evidence,
      "country_eligibility",
      "COUNTRY_ALLOWED",
      "allowed",
      input.activityEligibility.id,
      false,
      { countryCode }
    );
  } else if (input.activityEligibility.countryStatus === "human_review") {
    addFinding(findings, evidence, {
      state: "human_review",
      decision: "human_review",
      reasonCode: "COUNTRY_HUMAN_REVIEW",
      authority: "country_eligibility",
      status: "human_review",
      reference: input.activityEligibility.id,
      details: { countryCode },
    });
  } else if (input.activityEligibility.countryStatus === "pending") {
    addFinding(findings, evidence, {
      state: "pending",
      decision: "blocked",
      reasonCode: "COUNTRY_PENDING",
      authority: "country_eligibility",
      status: "pending",
      reference: input.activityEligibility.id,
      details: { countryCode },
    });
  } else {
    addFinding(findings, evidence, {
      state: "country_restricted",
      decision: "blocked",
      reasonCode: "COUNTRY_RESTRICTED",
      authority: "country_eligibility",
      status: "restricted",
      reference: input.activityEligibility.id,
      details: { countryCode },
    });
  }

  const provider = input.externalPaymentProvider;

  if (provider.economicIdentityId !== input.economicIdentity.id) {
    addFinding(findings, evidence, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "EXTERNAL_PROVIDER_IDENTITY_MISMATCH",
      authority: "external_payment_provider",
      status: "mismatch",
      reference: provider.externalAccountRef,
      details: { provider: provider.provider },
    });
  }

  if (provider.status === "ready") {
    addEvidence(
      evidence,
      "external_payment_provider",
      "EXTERNAL_PROVIDER_READY",
      "ready",
      provider.externalAccountRef,
      false,
      { provider: provider.provider }
    );
  } else if (provider.status === "human_review") {
    addFinding(findings, evidence, {
      state: "human_review",
      decision: "human_review",
      reasonCode: "EXTERNAL_PROVIDER_HUMAN_REVIEW",
      authority: "external_payment_provider",
      status: provider.status,
      reference: provider.externalAccountRef,
      details: { provider: provider.provider },
    });
  } else if (provider.status === "pending") {
    addFinding(findings, evidence, {
      state: "pending",
      decision: "blocked",
      reasonCode: "EXTERNAL_PROVIDER_PENDING",
      authority: "external_payment_provider",
      status: provider.status,
      reference: provider.externalAccountRef,
      details: { provider: provider.provider },
    });
  } else {
    addFinding(findings, evidence, {
      state: "restricted",
      decision: "blocked",
      reasonCode: "EXTERNAL_PROVIDER_RESTRICTED",
      authority: "external_payment_provider",
      status: provider.status,
      reference: provider.externalAccountRef,
      details: { provider: provider.provider },
    });
  }

  const applicableRequirements = provider.requirementsDue
    .filter((requirement) => requirementApplies(requirement, input.context.action))
    .map((requirement) => requirement.code.trim())
    .filter(Boolean)
    .sort();

  if (applicableRequirements.length > 0) {
    addFinding(findings, evidence, {
      state: "requirements_due",
      decision: "blocked",
      reasonCode: "EXTERNAL_REQUIREMENTS_DUE",
      authority: "external_payment_provider",
      status: "requirements_due",
      reference: provider.externalAccountRef,
      details: {
        provider: provider.provider,
        requirementCount: applicableRequirements.length,
        requirements: applicableRequirements.join(","),
      },
    });
  }

  if (input.context.action === "settlement") {
    if (!provider.settlementEnabled) {
      addFinding(findings, evidence, {
        state: "payouts_disabled",
        decision: "blocked",
        reasonCode: "EXTERNAL_SETTLEMENT_DISABLED",
        authority: "external_payment_provider",
        status: "disabled",
        reference: provider.externalAccountRef,
        details: { provider: provider.provider },
      });
    } else {
      addEvidence(
        evidence,
        "external_payment_provider",
        "EXTERNAL_SETTLEMENT_ENABLED",
        "enabled",
        provider.externalAccountRef,
        false,
        { provider: provider.provider }
      );
    }

    addEvidence(
      evidence,
      "external_payment_provider",
      "EXTERNAL_PAYOUT_RAIL_STATUS",
      provider.payoutsEnabled ? "enabled" : "disabled",
      provider.externalAccountRef,
      false,
      {
        provider: provider.provider,
        informationalForSettlement: true,
      }
    );
  } else if (!provider.payoutsEnabled) {
    addFinding(findings, evidence, {
      state: "payouts_disabled",
      decision: "blocked",
      reasonCode: "EXTERNAL_PAYOUTS_DISABLED",
      authority: "external_payment_provider",
      status: "disabled",
      reference: provider.externalAccountRef,
      details: { provider: provider.provider },
    });
  } else {
    addEvidence(
      evidence,
      "external_payment_provider",
      "EXTERNAL_PAYOUTS_ENABLED",
      "enabled",
      provider.externalAccountRef,
      false,
      { provider: provider.provider }
    );
  }

  const decision = selectDecision(findings);
  const state = selectOverallState(findings);
  const authorized = decision === "allowed";
  const reasonCodes = uniqueReasonCodes(findings, decision);

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
    reasonCodes,
    evidence,
  };

  return {
    state,
    decision,
    authorized,
    reasonCodes,
    evidence,
    auditEvent,
  };
}

export function settlementIsAuthorized(
  result: EconomicEligibilityResult
): boolean {
  return result.auditEvent.subject.action === "settlement" && result.authorized;
}
