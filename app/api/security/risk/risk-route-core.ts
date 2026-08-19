import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  calculateRisk,
  type RiskMetrics,
} from "@/lib/security-risk";

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

function assertCount(
  result: CountResult,
  label: string
): number {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.count ?? 0;
}

async function calculateForProfile(
  profile: {
    id: string;
    accountType: "client" | "provider";
  }
) {
  const providerFilter =
    `provider_id.eq.${profile.id},babysitter_id.eq.${profile.id}`;
  const bookingParticipantFilter =
    profile.accountType === "provider"
      ? providerFilter
      : `parent_id.eq.${profile.id}`;

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
    serviceProfileResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(bookingParticipantFilter),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(bookingParticipantFilter)
      .eq("status", "cancelled"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(bookingParticipantFilter)
      .eq("status", "rejected"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(bookingParticipantFilter)
      .eq("payment_status", "paid"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(bookingParticipantFilter)
      .eq("payment_status", "failed"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .or(bookingParticipantFilter)
      .eq("status", "completed"),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("opened_by", profile.id),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("against_profile_id", profile.id),
    supabaseAdmin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("against_profile_id", profile.id)
      .eq("reason", "unsafe_behavior")
      .in("status", [
        "open",
        "under_review",
        "waiting_user",
      ]),
    profile.accountType === "provider"
      ? supabaseAdmin
          .from("service_profiles")
          .select("id, stripe_onboarding_complete")
          .eq("profile_id", profile.id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),
  ]);

  const metrics: RiskMetrics = {
    totalBookings: assertCount(
      totalResult,
      "Réservations"
    ),
    cancelledBookings: assertCount(
      cancelledResult,
      "Annulations"
    ),
    rejectedBookings: assertCount(
      rejectedResult,
      "Refus"
    ),
    paidBookings: assertCount(
      paidResult,
      "Paiements"
    ),
    failedPayments: assertCount(
      failedPaymentResult,
      "Échecs de paiement"
    ),
    completedBookings: assertCount(
      completedResult,
      "Missions terminées"
    ),
    openedDisputes: assertCount(
      openedDisputesResult,
      "Litiges ouverts"
    ),
    receivedDisputes: assertCount(
      receivedDisputesResult,
      "Litiges reçus"
    ),
    urgentSafetyReports: assertCount(
      urgentReportsResult,
      "Signalements prioritaires"
    ),
    isProvider: profile.accountType === "provider",
    identityComplete:
      profile.accountType !== "provider" ||
      Boolean(
        serviceProfileResult.data
          ?.stripe_onboarding_complete
      ),
  };

  const assessment = calculateRisk(metrics);
  const now = new Date().toISOString();

  const { error: upsertError } = await supabaseAdmin
    .from("profile_risk_assessments")
    .upsert(
      {
        profile_id: profile.id,
        risk_score: assessment.score,
        risk_level: assessment.level,
        signals: assessment.signals,
        recommendations: assessment.recommendations,
        assessed_at: now,
        updated_at: now,
      },
      {
        onConflict: "profile_id",
      }
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
      .from("security_alerts")
      .upsert(
        {
          profile_id: profile.id,
          alert_type: alertType,
          severity,
          title: signal.label,
          description: signal.detail,
          status: "open",
          deduplication_key:
            `risk:${profile.id}:${signal.code}`,
        },
        {
          onConflict: "deduplication_key",
          ignoreDuplicates: true,
        }
      );

    if (alertError) {
      console.error(
        "Security alert error:",
        alertError.message
      );
    }
  }

  return { assessment, metrics };
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const { assessment, metrics } =
      await calculateForProfile(profile);

    const { data: alerts, error: alertsError } =
      await supabaseAdmin
        .from("security_alerts")
        .select(
          "id, alert_type, severity, title, description, status, created_at"
        )
        .eq("profile_id", profile.id)
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
        "KLYX détecte des signaux, mais aucune suspension définitive n’est décidée automatiquement.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’évaluer la sécurité du profil.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
