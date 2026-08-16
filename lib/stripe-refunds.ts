// KLYX_REFUND_CURRENCY_PHASE_5G
import type Stripe from "stripe";
import {
  tryReconcileBookingGroupStripeRefund,
} from "@/lib/stripe-group-refunds";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";

type RefundBooking = {
  id: string;
  parent_id: string;
  payment_status: string | null;
  payment_mode: string | null;
  amount_total: number | null;
  currency: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  refund_status: string | null;
};

function paymentIntentId(
  refund: Stripe.Refund
): string | null {
  return typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id ?? null;
}

async function findBookingFromRefund(
  refund: Stripe.Refund
): Promise<RefundBooking | null> {
  const bookingId =
    typeof refund.metadata?.booking_id === "string"
      ? refund.metadata.booking_id.trim()
      : "";

  if (bookingId) {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, payment_status, payment_mode, amount_total, currency, stripe_payment_intent_id, stripe_refund_id, refund_status"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (data) {
      return data as RefundBooking;
    }
  }

  const intentId = paymentIntentId(refund);

  if (!intentId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, payment_status, payment_mode, amount_total, currency, stripe_payment_intent_id, stripe_refund_id, refund_status"
    )
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data ? (data as RefundBooking) : null;
}

async function notifyRefundStatus(params: {
  bookingId: string;
  userId: string;
  status: "succeeded" | "failed";
  amount: number;
  currency: string | null;
}) {
  const currencyCode =
    String(
      params.currency ??
      ""
    )
      .trim()
      .toUpperCase();

  const amountLabel =
    /^[A-Z]{3}$/.test(
      currencyCode
    )
      ? new Intl.NumberFormat(
          "fr-BE",
          {
            style:
              "currency",
            currency:
              currencyCode,
          }
        ).format(
          params.amount /
          100
        )
      : (
          params.amount /
          100
        ).toFixed(2);

  const success = params.status === "succeeded";

  const { error } = await supabaseAdmin
    .from("user_notifications")
    .upsert(
      {
        user_id: params.userId,
        booking_id: params.bookingId,
        type: "system",
        title: success
          ? "Remboursement confirme"
          : "Remboursement a verifier",
        message: success
          ? `Le remboursement de ${amountLabel} a ete confirme par Stripe.`
          : "Stripe n'a pas pu finaliser le remboursement. KLYX va conserver cet incident pour verification.",
        href: `/bookings/${params.bookingId}`,
        deduplication_key: success
          ? `booking:${params.bookingId}:refund-confirmed`
          : `booking:${params.bookingId}:refund-failed`,
      },
      {
        onConflict: "deduplication_key",
        ignoreDuplicates: false,
      }
    );

  if (error) {
    console.error("Refund notification error:", error.message);
  }
}

export async function reconcileStripeRefund(
  refund: Stripe.Refund
): Promise<void> {
  // KLYX_SPLIT_REFUND_LEGACY_GUARD_13_28
  const splitUnitId =
    refund.metadata?.split_payment_unit_id?.trim() ?? "";

  const splitPaymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id ?? null;

  if (splitUnitId) {
    throw new Error(
      "Un remboursement split ne doit jamais passer par le moteur mono-réservation."
    );
  }

  if (splitPaymentIntentId) {
    const {
      data: splitPaymentUnit,
      error: splitPaymentUnitError,
    } = await supabaseAdmin
      .from("split_booking_payment_units")
      .select("id")
      .eq(
        "stripe_payment_intent_id",
        splitPaymentIntentId
      )
      .maybeSingle();

    if (splitPaymentUnitError) {
      throw new Error(
        splitPaymentUnitError.message
      );
    }

    if (splitPaymentUnit) {
      throw new Error(
        "Un remboursement split ne doit jamais passer par le moteur mono-réservation."
      );
    }
  }
  // KLYX_GROUP_REFUND_ROUTER_12_90
  const handledAsGroup =
    await tryReconcileBookingGroupStripeRefund(
      refund
    );

  if (handledAsGroup) {
    return;
  }
  const booking = await findBookingFromRefund(refund);

  if (!booking) {
    console.warn(
      "Aucune reservation KLYX associee au remboursement Stripe:",
      refund.id
    );
    return;
  }

  const intentId =
    paymentIntentId(refund) ??
    booking.stripe_payment_intent_id;

  const refundStatus =
    refund.status === "succeeded"
      ? "succeeded"
      : refund.status === "failed" ||
          refund.status === "canceled"
        ? "failed"
        : "processing";

  const now = new Date().toISOString();

  const { error: bookingError } = await supabaseAdmin
    .from("bookings")
    .update({
      refund_status: refundStatus,
      stripe_refund_id: refund.id,
      refunded_amount_cents: refund.amount,
      refunded_at:
        refundStatus === "succeeded"
          ? now
          : null,
      updated_at: now,
    })
    .eq("id", booking.id);

  if (bookingError) {
    throw new Error(bookingError.message);
  }

  await upsertFinancialLedgerEntry({
    bookingId: booking.id,
    entryKey: `booking:${booking.id}:refund:${refund.id}`,
    entryType:
      refundStatus === "failed"
        ? "refund_failed"
        : "refund_succeeded",
    status: refundStatus,
    currency: booking.currency,
    grossAmountCents: booking.amount_total,
    refundAmountCents: refund.amount,
    paymentMode: booking.payment_mode,
    stripePaymentIntentId: intentId,
    stripeRefundId: refund.id,
    failureCode:
      refundStatus === "failed"
        ? refund.failure_reason || "refund_failed"
        : null,
    failureMessage:
      refundStatus === "failed"
        ? "Stripe n'a pas pu finaliser ce remboursement."
        : null,
  });

  if (
    refundStatus === "succeeded" ||
    refundStatus === "failed"
  ) {
    await notifyRefundStatus({
      bookingId: booking.id,
      userId: booking.parent_id,
      status: refundStatus,
      amount: refund.amount,
      currency: booking.currency,
    });
  }
}
