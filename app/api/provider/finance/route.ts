import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  booking_date: string;
  status: string;
};

type LedgerRow = {
  id: string;
  booking_id: string;
  entry_type:
    | "payment_succeeded"
    | "payment_failed"
    | "refund_succeeded"
    | "refund_failed";
  status: "succeeded" | "failed" | "processing";
  currency: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  provider_amount_cents: number | null;
  refund_amount_cents: number;
  payment_mode: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

function cents(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(Math.round(number), 0) : 0;
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { data: bookingsData, error: bookingsError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          "id, parent_id, provider_id, babysitter_id, booking_date, status"
        )
        .or(
          `provider_id.eq.${profile.id},babysitter_id.eq.${profile.id}`
        )
        .order("created_at", { ascending: false });

    if (bookingsError) {
      throw new Error(bookingsError.message);
    }

    const bookings = (bookingsData ?? []) as BookingRow[];
    const bookingIds = bookings.map((booking) => booking.id);

    if (bookingIds.length === 0) {
      return NextResponse.json({
        summary: {
          currency: "EUR",
          grossPaidCents: 0,
          platformFeeCents: 0,
          providerAmountCents: 0,
          refundedCents: 0,
          refundsProcessingCents: 0,
          successfulPayments: 0,
          failedPayments: 0,
          successfulRefunds: 0,
        },
        transactions: [],
      });
    }

    const { data: ledgerData, error: ledgerError } =
      await supabaseAdmin
        .from("booking_financial_ledger")
        .select(
          "id, booking_id, entry_type, status, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, refund_amount_cents, payment_mode, stripe_checkout_session_id, stripe_payment_intent_id, stripe_refund_id, failure_code, failure_message, created_at, updated_at"
        )
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false });

    if (ledgerError) {
      throw new Error(ledgerError.message);
    }

    const ledger = (ledgerData ?? []) as LedgerRow[];

    const successfulPayments = ledger.filter(
      (entry) =>
        entry.entry_type === "payment_succeeded" &&
        entry.status === "succeeded"
    );

    const failedPayments = ledger.filter(
      (entry) =>
        entry.entry_type === "payment_failed" &&
        entry.status === "failed"
    );

    const successfulRefunds = ledger.filter(
      (entry) =>
        entry.entry_type === "refund_succeeded" &&
        entry.status === "succeeded"
    );

    const processingRefunds = ledger.filter(
      (entry) =>
        entry.entry_type === "refund_succeeded" &&
        entry.status === "processing"
    );

    const grossPaidCents = successfulPayments.reduce(
      (total, entry) => total + cents(entry.gross_amount_cents),
      0
    );

    const platformFeeCents = successfulPayments.reduce(
      (total, entry) => total + cents(entry.platform_fee_cents),
      0
    );

    const providerAmountCents = successfulPayments.reduce(
      (total, entry) => total + cents(entry.provider_amount_cents),
      0
    );

    const refundedCents = successfulRefunds.reduce(
      (total, entry) => total + cents(entry.refund_amount_cents),
      0
    );

    const refundsProcessingCents = processingRefunds.reduce(
      (total, entry) => total + cents(entry.refund_amount_cents),
      0
    );

    const currency =
      successfulPayments[0]?.currency ||
      ledger[0]?.currency ||
      "EUR";

    const bookingById = new Map(
      bookings.map((booking) => [booking.id, booking])
    );

    const transactions = ledger.slice(0, 100).map((entry) => {
      const booking = bookingById.get(entry.booking_id);

      return {
        id: entry.id,
        bookingId: entry.booking_id,
        bookingDate: booking?.booking_date ?? null,
        bookingStatus: booking?.status ?? null,
        entryType: entry.entry_type,
        status: entry.status,
        currency: entry.currency || "EUR",
        grossAmountCents: cents(entry.gross_amount_cents),
        platformFeeCents: cents(entry.platform_fee_cents),
        providerAmountCents:
          entry.provider_amount_cents == null
            ? null
            : cents(entry.provider_amount_cents),
        refundAmountCents: cents(entry.refund_amount_cents),
        paymentMode: entry.payment_mode,
        stripePaymentIntentId: entry.stripe_payment_intent_id,
        stripeRefundId: entry.stripe_refund_id,
        failureCode: entry.failure_code,
        failureMessage: entry.failure_message,
        createdAt: entry.created_at,
      };
    });

    return NextResponse.json({
      summary: {
        currency,
        grossPaidCents,
        platformFeeCents,
        providerAmountCents,
        refundedCents,
        refundsProcessingCents,
        successfulPayments: successfulPayments.length,
        failedPayments: failedPayments.length,
        successfulRefunds: successfulRefunds.length,
      },
      transactions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les finances.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
