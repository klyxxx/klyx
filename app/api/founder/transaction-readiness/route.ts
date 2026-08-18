import { NextResponse } from "next/server";

import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Check = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  severity: "blocking" | "warning" | "info";
};

type BookingRow = {
  id: string;
  status: string;
  payment_status: string | null;
  service_status: string | null;
  service_id: string | null;
  user_service_id: string | null;
  provider_id: string | null;
  babysitter_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  refund_status: string | null;
};

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

async function tableAccessible(
  table: string,
  startedAt: number
): Promise<{ ok: boolean; detail: string }> {
  const { error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    logServerError({
      error,
      event: `founder_transaction_table_${table}_unavailable`,
      route: "/api/founder/transaction-readiness",
      method: "GET",
      status: 500,
      code: `KLYX_FOUNDER_TRANSACTION_TABLE_${table}_UNAVAILABLE`,
      durationMs: Math.max(0, Date.now() - startedAt),
    });

    return {
      ok: false,
      detail: `${table} inaccessible.`,
    };
  }

  return { ok: true, detail: `${table} accessible.` };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxFounder();

    const checks: Check[] = [];

    checks.push({
      key: "stripe_secret",
      label: "Stripe secret",
      ok: envPresent("STRIPE_SECRET_KEY"),
      detail: envPresent("STRIPE_SECRET_KEY")
        ? "STRIPE_SECRET_KEY présente."
        : "STRIPE_SECRET_KEY absente.",
      severity: "blocking",
    });

    checks.push({
      key: "stripe_webhook",
      label: "Stripe webhook",
      ok:
        process.env.STRIPE_WEBHOOK_SECRET
          ?.trim()
          .startsWith("whsec_") ?? false,
      detail:
        process.env.STRIPE_WEBHOOK_SECRET
          ?.trim()
          .startsWith("whsec_")
          ? "Secret webhook whsec_ présent."
          : "STRIPE_WEBHOOK_SECRET absent ou invalide.",
      severity: "blocking",
    });

    checks.push({
      key: "stripe_mode",
      label: "Mode Stripe",
      ok: ["test", "live"].includes(
        process.env.KLYX_STRIPE_MODE?.trim() ?? ""
      ),
      detail: `KLYX_STRIPE_MODE=${
        process.env.KLYX_STRIPE_MODE?.trim() || "absent"
      }`,
      severity: "blocking",
    });

    const requiredTables = [
      "bookings",
      "booking_status_events",
      "booking_tracking_events",
      "stripe_webhook_events",
      "booking_financial_ledger",
      "reviews",
    ];

    const tableResults = await Promise.all(
      requiredTables.map(async (table) => ({
        table,
        ...(await tableAccessible(table, startedAt)),
      }))
    );

    for (const result of tableResults) {
      checks.push({
        key: `table_${result.table}`,
        label: result.table,
        ok: result.ok,
        detail: result.detail,
        severity: "blocking",
      });
    }

    const { data: bookingsData, error: bookingsError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          "id, status, payment_status, service_status, service_id, user_service_id, provider_id, babysitter_id, stripe_checkout_session_id, stripe_payment_intent_id, refund_status"
        )
        .order("created_at", { ascending: false })
        .limit(250);

    if (bookingsError) {
      logServerError({
        error: bookingsError,
        event: "founder_transaction_booking_audit_failed",
        route: "/api/founder/transaction-readiness",
        method: "GET",
        status: 500,
        code: "KLYX_FOUNDER_TRANSACTION_BOOKING_AUDIT_FAILED",
        durationMs: Math.max(0, Date.now() - startedAt),
      });

      checks.push({
        key: "booking_audit",
        label: "Audit réservations",
        ok: false,
        detail: "Audit des réservations indisponible.",
        severity: "blocking",
      });
    } else {
      const bookings = (bookingsData ?? []) as BookingRow[];

      const legacyMissingService = bookings.filter(
        (booking) =>
          !booking.service_id || !booking.user_service_id
      );

      const paidWithoutIntent = bookings.filter(
        (booking) =>
          booking.payment_status === "paid" &&
          !booking.stripe_payment_intent_id
      );

      const completedNotPaid = bookings.filter(
        (booking) =>
          booking.status === "completed" &&
          booking.payment_status !== "paid"
      );

      const missingProvider = bookings.filter(
        (booking) =>
          !booking.provider_id && !booking.babysitter_id
      );

      const acceptedWithoutServiceStatus = bookings.filter(
        (booking) =>
          booking.status === "accepted" &&
          !booking.service_status
      );

      checks.push({
        key: "legacy_service_snapshot",
        label: "Réservations avec métier",
        ok: legacyMissingService.length === 0,
        detail:
          legacyMissingService.length === 0
            ? "Les réservations récentes possèdent service_id et user_service_id."
            : `${legacyMissingService.length} réservation(s) récente(s) sont anciennes et n'ont pas de métier complet. Elles ne doivent pas être payées.`,
        severity: "warning",
      });

      checks.push({
        key: "paid_intent",
        label: "Paiements reliés à Stripe",
        ok: paidWithoutIntent.length === 0,
        detail:
          paidWithoutIntent.length === 0
            ? "Aucun paiement paid sans PaymentIntent."
            : `${paidWithoutIntent.length} paiement(s) paid sans stripe_payment_intent_id.`,
        severity: "blocking",
      });

      checks.push({
        key: "completed_paid",
        label: "Mission terminée = paiement confirmé",
        ok: completedNotPaid.length === 0,
        detail:
          completedNotPaid.length === 0
            ? "Aucune mission terminée sans paiement confirmé."
            : `${completedNotPaid.length} mission(s) completed sans payment_status=paid.`,
        severity: "blocking",
      });

      checks.push({
        key: "provider_link",
        label: "Prestataire relié",
        ok: missingProvider.length === 0,
        detail:
          missingProvider.length === 0
            ? "Toutes les réservations récentes ont un prestataire."
            : `${missingProvider.length} réservation(s) sans provider_id/babysitter_id.`,
        severity: "blocking",
      });

      checks.push({
        key: "accepted_tracking",
        label: "Suivi des réservations acceptées",
        ok: acceptedWithoutServiceStatus.length === 0,
        detail:
          acceptedWithoutServiceStatus.length === 0
            ? "Les réservations acceptées ont un service_status."
            : `${acceptedWithoutServiceStatus.length} réservation(s) accepted sans service_status.`,
        severity: "warning",
      });
    }

    const { data: ledgerData, error: ledgerError } =
      await supabaseAdmin
        .from("booking_financial_ledger")
        .select("booking_id, entry_type, status")
        .eq("entry_type", "payment_succeeded")
        .eq("status", "succeeded")
        .limit(1000);

    if (ledgerError) {
      logServerError({
        error: ledgerError,
        event: "founder_transaction_ledger_audit_failed",
        route: "/api/founder/transaction-readiness",
        method: "GET",
        status: 500,
        code: "KLYX_FOUNDER_TRANSACTION_LEDGER_AUDIT_FAILED",
        durationMs: Math.max(0, Date.now() - startedAt),
      });

      checks.push({
        key: "payment_ledger_audit",
        label: "Anti-double paiement ledger",
        ok: false,
        detail: "Audit du ledger financier indisponible.",
        severity: "blocking",
      });
    } else {
      const counts = new Map<string, number>();

      for (const row of ledgerData ?? []) {
        const bookingId = String(row.booking_id ?? "");
        if (!bookingId) continue;
        counts.set(
          bookingId,
          (counts.get(bookingId) ?? 0) + 1
        );
      }

      const duplicates = [...counts.values()].filter(
        (count) => count > 1
      ).length;

      checks.push({
        key: "payment_duplicates",
        label: "Double paiement",
        ok: duplicates === 0,
        detail:
          duplicates === 0
            ? "Aucun booking avec plusieurs payment_succeeded dans le ledger."
            : `${duplicates} réservation(s) ont plusieurs écritures payment_succeeded.`,
        severity: "blocking",
      });
    }

    const blocking = checks.filter(
      (check) =>
        check.severity === "blocking" && !check.ok
    ).length;

    const warnings = checks.filter(
      (check) =>
        check.severity === "warning" && !check.ok
    ).length;

    return NextResponse.json({
      ready: blocking === 0,
      blocking,
      warnings,
      checks,
      flow: [
        "Création réservation",
        "Acceptation prestataire",
        "Checkout Stripe",
        "Webhook = paid",
        "Suivi scheduled → en_route → arrived → in_progress",
        "Prestataire déclare terminé",
        "Client confirme",
        "Mission completed",
        "Avis vérifié",
        "KLYX Score recalculé",
      ],
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_transaction_readiness_failed",
      route: "/api/founder/transaction-readiness",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_TRANSACTION_READINESS_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
      details: {
        ready: false,
      },
    });
  }
}
