import "server-only";

import {
  evaluateCanonicalAccountRisk,
  evaluateCanonicalAccountRiskById,
  type CanonicalRiskAccount,
} from "@/lib/account-risk-server";
import type { AuthenticatedAccount } from "@/lib/api-auth";
import {
  assessTransactionRisk,
  type TransactionRiskAction,
  type TransactionRiskAssessment,
  type TransactionRiskDecision,
  type TransactionRiskParticipant,
} from "@/lib/transaction-risk-policy";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const TRANSACTION_RISK_REVIEW_REQUIRED =
  "KLYX_TRANSACTION_RISK_REVIEW_REQUIRED";
export const TRANSACTION_RISK_BLOCKED = "KLYX_TRANSACTION_RISK_BLOCKED";

export type TransactionRiskSubjectType =
  | "booking"
  | "booking_group"
  | "split_batch";

// Backward-compatible export retained for checkout callers and tests.
export type CheckoutRiskSubjectType = TransactionRiskSubjectType;

type ProfileAccountRow = {
  id: string;
  account_id: string | null;
  owner_user_id: string;
};

type AccountOwnerRow = {
  id: string;
  auth_user_id: string;
};

export class TransactionRiskGateError extends Error {
  readonly code: string;
  readonly decision: Exclude<TransactionRiskDecision, "allow">;
  readonly participant: TransactionRiskParticipant;
  readonly reasonCodes: readonly string[];

  constructor(input: {
    decision: Exclude<TransactionRiskDecision, "allow">;
    participant: TransactionRiskParticipant;
    reasonCodes: readonly string[];
  }) {
    const code =
      input.decision === "blocked"
        ? TRANSACTION_RISK_BLOCKED
        : TRANSACTION_RISK_REVIEW_REQUIRED;
    super(code);
    this.name = "TransactionRiskGateError";
    this.code = code;
    this.decision = input.decision;
    this.participant = input.participant;
    this.reasonCodes = input.reasonCodes;
  }
}

export function isTransactionRiskGateError(
  error: unknown
): error is TransactionRiskGateError {
  return error instanceof TransactionRiskGateError;
}

async function recordDecision(input: {
  accountId: string;
  subjectType: TransactionRiskSubjectType;
  subjectId: string;
  result: TransactionRiskAssessment;
  riskScore: number;
  riskLevel: string;
  riskAssessedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const deduplicationKey = [
    input.result.action,
    input.subjectType,
    input.subjectId,
    input.result.participant,
    input.accountId,
  ].join(":");

  const { error } = await supabaseAdmin
    .from("transaction_risk_decisions")
    .upsert(
      {
        account_id: input.accountId,
        action: input.result.action,
        participant: input.result.participant,
        decision: input.result.decision,
        reason_codes: input.result.reasonCodes,
        risk_score: input.riskScore,
        risk_level: input.riskLevel,
        risk_assessed_at: input.riskAssessedAt,
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        deduplication_key: deduplicationKey,
        updated_at: now,
      },
      { onConflict: "deduplication_key" }
    );

  if (error) throw new Error(error.message);
}

async function assessCanonicalParticipant(input: {
  account: CanonicalRiskAccount;
  action: TransactionRiskAction;
  participant: TransactionRiskParticipant;
  subjectType: TransactionRiskSubjectType;
  subjectId: string;
}) {
  const evaluation = await evaluateCanonicalAccountRisk(input.account);
  const result = assessTransactionRisk({
    action: input.action,
    participant: input.participant,
    assessment: evaluation.assessment,
    metrics: evaluation.metrics,
  });

  await recordDecision({
    accountId: input.account.id,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    result,
    riskScore: evaluation.assessment.score,
    riskLevel: evaluation.assessment.level,
    riskAssessedAt: evaluation.assessedAt,
  });

  if (result.decision !== "allow") {
    throw new TransactionRiskGateError({
      decision: result.decision,
      participant: result.participant,
      reasonCodes: result.reasonCodes,
    });
  }
}

async function assessCanonicalParticipantById(input: {
  accountId: string;
  canOfferServices: boolean;
  action: TransactionRiskAction;
  participant: TransactionRiskParticipant;
  subjectType: TransactionRiskSubjectType;
  subjectId: string;
}) {
  const evaluation = await evaluateCanonicalAccountRiskById(
    input.accountId,
    input.canOfferServices
  );
  const result = assessTransactionRisk({
    action: input.action,
    participant: input.participant,
    assessment: evaluation.assessment,
    metrics: evaluation.metrics,
  });

  await recordDecision({
    accountId: input.accountId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    result,
    riskScore: evaluation.assessment.score,
    riskLevel: evaluation.assessment.level,
    riskAssessedAt: evaluation.assessedAt,
  });

  if (result.decision !== "allow") {
    throw new TransactionRiskGateError({
      decision: result.decision,
      participant: result.participant,
      reasonCodes: result.reasonCodes,
    });
  }
}

async function resolveCanonicalAccountIdsForProfiles(
  profileIds: readonly string[]
): Promise<string[]> {
  const uniqueProfileIds = Array.from(
    new Set(profileIds.map((value) => value.trim()).filter(Boolean))
  );

  if (uniqueProfileIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, account_id, owner_user_id")
    .in("id", uniqueProfileIds);

  if (error) throw new Error(error.message);

  const profiles = (data ?? []) as ProfileAccountRow[];
  if (profiles.length !== uniqueProfileIds.length) {
    throw new Error("KLYX_TRANSACTION_RISK_PROFILE_NOT_FOUND");
  }

  const missingOwners = Array.from(
    new Set(
      profiles
        .filter((profile) => !profile.account_id)
        .map((profile) => profile.owner_user_id)
    )
  );
  const accountByOwner = new Map<string, string>();

  if (missingOwners.length > 0) {
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id, auth_user_id")
      .in("auth_user_id", missingOwners);

    if (accountError) throw new Error(accountError.message);

    for (const account of (accountData ?? []) as AccountOwnerRow[]) {
      accountByOwner.set(account.auth_user_id, account.id);
    }
  }

  const accountIds = profiles.map((profile) => {
    const accountId =
      profile.account_id ?? accountByOwner.get(profile.owner_user_id) ?? null;

    if (!accountId) {
      throw new Error("KLYX_TRANSACTION_RISK_ACCOUNT_NOT_FOUND");
    }

    return accountId;
  });

  return Array.from(new Set(accountIds));
}

export async function enforceCheckoutTransactionRisk(input: {
  payerAccount: AuthenticatedAccount;
  recipientProfileIds: readonly string[];
  subjectType: CheckoutRiskSubjectType;
  subjectId: string;
}): Promise<void> {
  const payer: CanonicalRiskAccount = {
    id: input.payerAccount.id,
    authUserId: input.payerAccount.authUserId,
    canOfferServices: input.payerAccount.canOfferServices,
  };

  await assessCanonicalParticipant({
    account: payer,
    action: "checkout_create",
    participant: "payer",
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  });

  const recipientAccountIds = await resolveCanonicalAccountIdsForProfiles(
    input.recipientProfileIds
  );

  for (const accountId of recipientAccountIds) {
    await assessCanonicalParticipantById({
      accountId,
      canOfferServices: true,
      action: "checkout_create",
      participant: "recipient",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    });
  }
}

export async function enforceRefundTransactionRisk(input: {
  requesterAccount: AuthenticatedAccount;
  refundRecipientProfileId: string;
  subjectType: Extract<TransactionRiskSubjectType, "booking" | "booking_group">;
  subjectId: string;
}): Promise<void> {
  const recipientAccountIds = await resolveCanonicalAccountIdsForProfiles([
    input.refundRecipientProfileId,
  ]);
  const recipientAccountId = recipientAccountIds[0];

  if (!recipientAccountId) {
    throw new Error("KLYX_TRANSACTION_RISK_REFUND_RECIPIENT_NOT_FOUND");
  }

  await assessCanonicalParticipantById({
    accountId: recipientAccountId,
    canOfferServices: true,
    action: "refund_create",
    participant: "refund_recipient",
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  });

  if (input.requesterAccount.id !== recipientAccountId) {
    const requester: CanonicalRiskAccount = {
      id: input.requesterAccount.id,
      authUserId: input.requesterAccount.authUserId,
      canOfferServices: input.requesterAccount.canOfferServices,
    };

    await assessCanonicalParticipant({
      account: requester,
      action: "refund_create",
      participant: "requester",
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    });
  }
}

export async function enforceSettlementReleaseTransactionRisk(input: {
  recipientProfileId: string;
  subjectId: string;
}): Promise<void> {
  const recipientAccountIds = await resolveCanonicalAccountIdsForProfiles([
    input.recipientProfileId,
  ]);
  const recipientAccountId = recipientAccountIds[0];

  if (!recipientAccountId) {
    throw new Error("KLYX_TRANSACTION_RISK_SETTLEMENT_RECIPIENT_NOT_FOUND");
  }

  await assessCanonicalParticipantById({
    accountId: recipientAccountId,
    canOfferServices: true,
    action: "settlement_release",
    participant: "settlement_recipient",
    subjectType: "booking",
    subjectId: input.subjectId,
  });
}
