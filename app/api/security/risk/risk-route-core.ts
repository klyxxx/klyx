import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import {
  calculateRisk,
  type RiskMetrics,
} from "@/lib/security-risk";
import { getCanonicalStripeConnect } from "@/lib/stripe-connect-account";

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

type AccountContext = {
  id: string;
  authUserId: string;
  canRequestServices: boolean;
  canOfferServices: boolean;
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

async function loadAccountProfileIds(account: AccountContext): Promise<string[]> {
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

async function calculateForAccount(account: AccountContext) {
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
      ? getCanonicalStripeConnect(account.id)
      : Promise.resolve(null),
  ]);

  const identityComplete =
    !account.canOfferServices ||
    Boolean(
      connect?.state === "linked" &&
        connect.stripeAccountId &&
        connect.onboardingComplete &&
        connect.chargesEnabled &&
        connect.payoutsEnabled
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
      account.canOfferServices && connect?.state === "review_required",
  };

  const assessment = calculateRisk(metrics);
  const now = new Date().toISOString();

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
        assessed_at: now,
        updated_at: now,
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
          updated_at: now,
          deduplication_key: `risk:${account.id}:${signal.code}`,
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true }
      );

    if (alertError) {
      console.error("Security alert error:", alertError.message);
    }
  }

  return { assessment, metrics };
}

export async function GET(request: Request) {
  try {
    const { account } = await getAuthenticatedAccount(request);
    const { assessment, metrics } = await calculateForAccount(account);

    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("account_security_alerts")
      .select(
        "id, alert_type, severity, title, description, status, created_at"
      )
      .eq("account_id", account.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (alertsError) {
      throw new Error(alertsError.message);
    }

    return NextResponse.json({
      assessment,
      metrics,
      alerts: alerts ?? [],
      automaticRestriction: false,
      explanation:
        "KLYX détecte les signaux au niveau du compte canonique, mais aucune suspension définitive n’est décidée automatiquement.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’évaluer la sécurité du compte.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
