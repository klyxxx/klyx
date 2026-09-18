import "server-only";

import { calculateRisk, type RiskAssessment, type RiskMetrics } from "@/lib/security-risk";
import { getAccountStripeConnectIdentity } from "@/lib/stripe-connect-account-identity";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type CanonicalRiskAccount = {
  id: string;
  authUserId: string;
  canOfferServices: boolean;
};

export type CanonicalAccountRiskEvaluation = {
  assessment: RiskAssessment;
  metrics: RiskMetrics;
  assessedAt: string;
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

type AccountRow = {
  id: string;
  auth_user_id: string;
};

type ProfileRow = {
  id: string;
  account_id: string | null;
};

function assertCount(result: CountResult, label: string): number {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.count ?? 0;
}

function bookingParticipantFilter(profileIds: readonly string[]): string {
  const ids = profileIds.join(",");
  return [
    `parent_id.in.(${ids})`,
    `provider_id.in.(${ids})`,
    `babysitter_id.in.(${ids})`,
  ].join(",");
}

async function loadAccountProfileIds(account: CanonicalRiskAccount): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, account_id")
    .eq("owner_user_id", account.authUserId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const profiles = (data ?? []) as ProfileRow[];

  if (profiles.length === 0) {
    throw new Error("Profil KLYX introuvable.");
  }

  if (
    profiles.some(
      (profile) =>
        profile.account_id !== null && profile.account_id !== account.id
    )
  ) {
    throw new Error("KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH");
  }

  return profiles.map((profile) => profile.id);
}

async function persistRiskSignals(input: {
  account: CanonicalRiskAccount;
  assessment: RiskAssessment;
  metrics: RiskMetrics;
  assessedAt: string;
}): Promise<void> {
  const { account, assessment, metrics, assessedAt } = input;

  const { error: upsertError } = await supabaseAdmin
    .from("account_risk_assessments")
    .upsert(
      {
        account_id: account.id,
        risk_score: assessment.score,
        risk_level: assessment.level,
        signals: assessment.signals,
        recommendations: assessment.recommendations,
        metrics,
        assessed_at: assessedAt,
        updated_at: assessedAt,
      },
      { onConflict: "account_id" }
    );

  if (upsertError) throw new Error(upsertError.message);

  for (const signal of assessment.signals) {
    if (signal.points <= 0) continue;

    const alertType =
      signal.code === "repeated_cancellations"
        ? "repeated_cancellations"
        : signal.code.includes("dispute")
          ? "multiple_disputes"
          : signal.code === "payment_failures"
            ? "payment_failures"
            : signal.code === "financial_identity_review_required"
              ? "financial_identity_review_required"
              : signal.code === "identity_incomplete"
                ? "identity_incomplete"
                : signal.code === "safety_report"
                  ? "safety_report"
                  : "unusual_activity";

    const severity =
      signal.points >= 35
        ? "critical"
        : signal.points >= 20
          ? "high"
          : signal.points >= 10
            ? "warning"
            : "info";

    const { error: alertError } = await supabaseAdmin
      .from("account_security_alerts")
      .upsert(
        {
          account_id: account.id,
          alert_type: alertType,
          severity,
          title: signal.label,
          description: signal.detail,
          status: "open",
          updated_at: assessedAt,
          deduplication_key: `risk:${account.id}:${signal.code}`,
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true }
      );

    if (alertError) {
      console.error("Security alert error:", alertError.message);
    }
  }
}

export async function loadCanonicalRiskAccount(
  accountId: string,
  canOfferServices: boolean
): Promise<CanonicalRiskAccount> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("id, auth_user_id")
    .eq("id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Compte KLYX canonique introuvable.");

  const account = data as AccountRow;
  return {
    id: account.id,
    authUserId: account.auth_user_id,
    canOfferServices,
  };
}

export async function evaluateCanonicalAccountRisk(
  account: CanonicalRiskAccount
): Promise<CanonicalAccountRiskEvaluation> {
  const profileIds = await loadAccountProfileIds(account);
  const participantFilter = bookingParticipantFilter(profileIds);

  const [
    totalResult,
    cancelledResult,
    rejectedResult,
    paidResult,
    failedPaymentResult,
    completedResult,
    openedDisputesResult,
    receivedDisputesResult,
    urgentReportsResult,
    connect,
  ] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(participantFilter),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(participantFilter)
      .eq("status", "cancelled"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(participantFilter)
      .eq("status", "rejected"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(participantFilter)
      .eq("payment_status", "paid"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(participantFilter)
      .eq("payment_status", "failed"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(participantFilter)
      .eq("status", "completed"),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .in("opened_by", profileIds),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .in("against_profile_id", profileIds),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .in("against_profile_id", profileIds)
      .eq("reason", "unsafe_behavior")
      .in("status", ["open", "under_review", "waiting_user"]),
    account.canOfferServices
      ? getAccountStripeConnectIdentity(account.id)
      : Promise.resolve(null),
  ]);

  const identityComplete =
    !account.canOfferServices ||
    Boolean(
      connect?.state === "linked" &&
        connect.stripeAccountId
    );

  const metrics: RiskMetrics = {
    totalBookings: assertCount(totalResult, "Réservations"),
    cancelledBookings: assertCount(cancelledResult, "Annulations"),
    rejectedBookings: assertCount(rejectedResult, "Refus"),
    paidBookings: assertCount(paidResult, "Paiements"),
    failedPayments: assertCount(failedPaymentResult, "Échecs de paiement"),
    completedBookings: assertCount(completedResult, "Missions terminées"),
    openedDisputes: assertCount(openedDisputesResult, "Litiges ouverts"),
    receivedDisputes: assertCount(receivedDisputesResult, "Litiges reçus"),
    urgentSafetyReports: assertCount(
      urgentReportsResult,
      "Signalements prioritaires"
    ),
    isProvider: account.canOfferServices,
    identityComplete,
    financialIdentityReviewRequired:
      account.canOfferServices && connect?.state === "conflict",
  };

  const assessment = calculateRisk(metrics);
  const assessedAt = new Date().toISOString();

  await persistRiskSignals({
    account,
    assessment,
    metrics,
    assessedAt,
  });

  return { assessment, metrics, assessedAt };
}

export async function evaluateCanonicalAccountRiskById(
  accountId: string,
  canOfferServices: boolean
): Promise<CanonicalAccountRiskEvaluation> {
  const account = await loadCanonicalRiskAccount(accountId, canOfferServices);
  return evaluateCanonicalAccountRisk(account);
}
