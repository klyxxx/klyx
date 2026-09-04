// KLYX_REFUND_CURRENCY_PHASE_5G
// KLYX_REFUND_MONOTONE_RECONCILIATION_16_11
// KLYX_REFUND_AGGREGATE_RECONCILIATION_16_12
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

type RefundAggregate = {
  succeededAmount: number;
  hasProcessing: boolean;
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

async function bookingRefundSucceeded(
  bookingId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("refund_status")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.refund_status === "succeeded";
}

async function aggregateBookingRefunds(
  bookingId: string,
  intentId: string | null
): Promise<RefundAggregate> {
  let query = supabaseAdmin
    .from("booking_financial_ledger")
    .select("status, refund_amount_cents, stripe_payment_intent_id")
    .eq("booking_id", bookingId)
    .in("entry_type", ["refund_succeeded", "refund_failed"]);

  if (intentId) {
    query = query.eq("stripe_payment_intent_id", intentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let succeededAmount = 0;
  let hasProcessing = false;

  for (const row of data ?? []) {
    if (row.status === "succeeded") {
      succeededAmount += Math.max(
        Number(row.refund_amount_cents ?? 0),
        0
      );
    } else if (row.status === "processing") {
      hasProcessing = true;
    }
  }

  return {
    succeededAmount,
    hasProcessing,
  };
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

  const incomingIntentId = paymentIntentId(refund);

  // A refund from an older Stripe payment attempt must never mutate the
  // currently attached payment for this booking.
  if (
    booking.stripe_payment_intent_id &&
    incomingIntentId &&
    booking.stripe_payment_intent_id !== incomingIntentId
  ) {
    return;
  }

  const intentId =
    incomingIntentId ??
    booking.stripe_payment_intent_id;

  const stripeRefundStatus =
    refund.status === "succeeded"
      ? "succeeded"
      : refund.status === "failed" ||
          refund.status === "canceled"
        ? "failed"
        : "processing";

  // Persist the individual Stripe refund first. entry_key makes webhook
  // retries idempotent and lets us safely aggregate multiple partial refunds.
  await upsertFinancialLedgerEntry({
    bookingId: booking.id,
    entryKey: `booking:${booking.id}:refund:${refund.id}`,
    entryType:
      stripeRefundStatus === "failed"
        ? "refund_failed"
        : "refund_succeeded",
    status: stripeRefundStatus,
    currency: booking.currency,
    grossAmountCents: booking.amount_total,
    refundAmountCents: refund.amount,
    paymentMode: booking.payment_mode,
    stripePaymentIntentId: intentId,
    stripeRefundId: refund.id,
    failureCode:
      stripeRefundStatus === "failed"
        ? refund.failure_reason || "refund_failed"
        : null,
    failureMessage:
      stripeRefundStatus === "failed"
        ? "Stripe n'a pas pu finaliser ce remboursement."
        : null,
  });

  const aggregate = await aggregateBookingRefunds(
    booking.id,
    intentId
  );

  const grossAmount = Math.max(
    Number(booking.amount_total ?? 0),
    0
  );

  if (grossAmount <= 0) {
    throw new Error("KLYX_REFUND_GROSS_AMOUNT_INVALID");
  }

  const succeededAmount = Math.min(
    aggregate.succeededAmount,
    grossAmount
  );

  const fullyRefunded = succeededAmount >= grossAmount;

  const refundStatus: "processing" | "succeeded" | "failed" =
    fullyRefunded
      ? "succeeded"
      : succeededAmount > 0 ||
          aggregate.hasProcessing ||
          stripeRefundStatus === "processing" ||
          stripeRefundStatus === "succeeded"
        ? "processing"
        : "failed";

  if (
    refundStatus !== "succeeded" &&
    booking.refund_status === "succeeded"
  ) {
    return;
  }

  const now = new Date().toISOString();

  const bookingUpdate = supabaseAdmin
    .from("bookings")
    .update({
      refund_status: refundStatus,
      stripe_refund_id: refund.id,
      refunded_amount_cents: succeededAmount,
      refunded_at:
        refundStatus === "succeeded"
          ? now
          : null,
      payment_status:
        refundStatus === "succeeded"
          ? "refunded"
          : booking.payment_status,
      updated_at: now,
    })
    .eq("id", booking.id);

  const guardedBookingUpdate =
    refundStatus === "succeeded"
      ? bookingUpdate
      : bookingUpdate.or(
          "refund_status.is.null,refund_status.neq.succeeded"
        );

  const {
    data: updatedBooking,
    error: bookingError,
  } = await guardedBookingUpdate
    .select("id")
    .maybeSingle();

  if (bookingError) {
    throw new Error(bookingError.message);
  }

  if (!updatedBooking) {
    if (
      refundStatus !== "succeeded" &&
      await bookingRefundSucceeded(
        booking.id
      )
    ) {
      return;
    }

    throw new Error(
      "KLYX_REFUND_STATE_UPDATE_LOST"
    );
  }

  if (
    stripeRefundStatus === "failed" &&
    refundStatus !== "succeeded" &&
    succeededAmount === 0
  ) {
    await notifyRefundStatus({
      bookingId: booking.id,
      userId: booking.parent_id,
      status: "failed",
      amount: refund.amount,
      currency: booking.currency,
    });

    return;
  }

  if (refundStatus === "succeeded") {
    await notifyRefundStatus({
      bookingId: booking.id,
      userId: booking.parent_id,
      status: "succeeded",
      amount: succeededAmount,
      currency: booking.currency,
    });
  }
}
