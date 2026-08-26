import type Stripe from "stripe";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

import {
  upsertFinancialLedgerEntry,
} from "@/lib/payment-ledger";

// KLYX_SPLIT_STRIPE_WEBHOOK_13_27
// KLYX_SPLIT_REFUND_RECONCILIATION_13_28
// KLYX_SPLIT_PAID_RETRY_REPAIR_16_09

type UnitRow = {
  id:
    string;

  run_id:
    string;

  batch_id:
    string;

  client_profile_id:
    string;

  provider_profile_id:
    string;

  amount_cents:
    number;

  currency:
    string;

  booking_ids:
    unknown;

  application_fee_amount:
    number;

  status:
    string;

  stripe_checkout_session_id:
    string | null;

  stripe_payment_intent_id:
    string | null;

  refund_status:
    string;

  refunded_amount_cents:
    number;
};

type BookingRow = {
  id:
    string;

  parent_id:
    string;

  provider_id:
    string | null;

  babysitter_id:
    string | null;

  amount_total:
    number | null;

  estimated_amount_cents:
    number | null;

  currency:
    string | null;

  payment_status:
    string | null;
};

type RefundRow = {
  stripe_refund_id:
    string;

  amount_cents:
    number;

  status:
    string;
};

function strings(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item ===
        "string" &&
      Boolean(
        item.trim()
      )
  );
}

function paymentIntentIdFromSession(
  session:
    Stripe.Checkout.Session
): string | null {
  if (
    typeof session.payment_intent ===
    "string"
  ) {
    return session.payment_intent;
  }

  return session.payment_intent
    ?.id ??
    null;
}

function paymentIntentIdFromRefund(
  refund:
    Stripe.Refund
): string | null {
  if (
    typeof refund.payment_intent ===
    "string"
  ) {
    return refund.payment_intent;
  }

  return refund.payment_intent
    ?.id ??
    null;
}

function bookingAmount(
  booking:
    BookingRow
): number {
  return Math.round(
    booking.estimated_amount_cents ??
      booking.amount_total ??
      0
  );
}

function refundState(
  refund:
    Stripe.Refund
):
  | "processing"
  | "succeeded"
  | "failed" {
  if (
    refund.status ===
    "succeeded"
  ) {
    return "succeeded";
  }

  if (
    refund.status ===
      "failed" ||
    refund.status ===
      "canceled"
  ) {
    return "failed";
  }

  return "processing";
}

async function getUnit(
  unitId:
    string
): Promise<UnitRow> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .select(
        "id, run_id, batch_id, client_profile_id, provider_profile_id, amount_cents, currency, booking_ids, application_fee_amount, status, stripe_checkout_session_id, stripe_payment_intent_id, refund_status, refunded_amount_cents"
      )
      .eq(
        "id",
        unitId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!data) {
    throw new Error(
      "Unité de paiement split introuvable."
    );
  }

  return data as unknown as
    UnitRow;
}

async function findUnitForRefund(
  refund:
    Stripe.Refund
): Promise<UnitRow | null> {
  const metadataUnitId =
    refund.metadata
      ?.split_payment_unit_id
      ?.trim();

  if (metadataUnitId) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "split_booking_payment_units"
        )
        .select(
          "id, run_id, batch_id, client_profile_id, provider_profile_id, amount_cents, currency, booking_ids, application_fee_amount, status, stripe_checkout_session_id, stripe_payment_intent_id, refund_status, refunded_amount_cents"
        )
        .eq(
          "id",
          metadataUnitId
        )
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (data) {
      return data as unknown as
        UnitRow;
    }
  }

  const paymentIntentId =
    paymentIntentIdFromRefund(
      refund
    );

  if (!paymentIntentId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .select(
        "id, run_id, batch_id, client_profile_id, provider_profile_id, amount_cents, currency, booking_ids, application_fee_amount, status, stripe_checkout_session_id, stripe_payment_intent_id, refund_status, refunded_amount_cents"
      )
      .eq(
        "stripe_payment_intent_id",
        paymentIntentId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return data
    ? data as unknown as
        UnitRow
    : null;
}

async function getBookingsForUnit(
  unit:
    UnitRow
): Promise<BookingRow[]> {
  const bookingIds =
    strings(
      unit.booking_ids
    );

  if (
    bookingIds.length ===
    0
  ) {
    throw new Error(
      "Réservations split manquantes."
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "bookings"
      )
      .select(
        "id, parent_id, provider_id, babysitter_id, amount_total, estimated_amount_cents, currency, payment_status"
      )
      .in(
        "id",
        bookingIds
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  const bookings =
    (
      data ??
      []
    ) as unknown as
      BookingRow[];

  if (
    bookings.length !==
    bookingIds.length
  ) {
    throw new Error(
      "Réservations split incomplètes."
    );
  }

  return bookings;
}

async function refreshRunPaymentStatus(
  runId:
    string
) {
  const {
    data:
      unitData,

    error:
      unitError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .select(
        "status, refund_status"
      )
      .eq(
        "run_id",
        runId
      );

  if (unitError) {
    throw new Error(
      unitError.message
    );
  }

  const rows =
    unitData ??
    [];

  const total =
    rows.length;

  const paidCount =
    rows.filter(
      (
        row
      ) =>
        row.status ===
        "paid"
    ).length;

  const refundedCount =
    rows.filter(
      (
        row
      ) =>
        row.refund_status ===
        "refunded"
    ).length;

  const refundActivity =
    rows.filter(
      (
        row
      ) =>
        row.refund_status !==
        "none"
    ).length;

  let nextStatus =
    "ready";

  if (
    total > 0 &&
    refundedCount ===
      total
  ) {
    nextStatus =
      "refunded";
  }
  else if (
    refundActivity >
    0
  ) {
    nextStatus =
      "partially_refunded";
  }
  else if (
    total > 0 &&
    paidCount ===
      total
  ) {
    nextStatus =
      "paid";
  }
  else if (
    paidCount >
    0
  ) {
    nextStatus =
      "partially_paid";
  }

  const update:
    Record<
      string,
      unknown
    > = {
    status:
      nextStatus,

    updated_at:
      new Date()
        .toISOString(),
  };

  if (
    nextStatus ===
    "paid"
  ) {
    update.paid_at =
      new Date()
        .toISOString();
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_runs"
      )
      .update(
        update
      )
      .eq(
        "id",
        runId
      );

  if (error) {
    throw new Error(
      error.message
    );
  }
}

async function markPaid(
  session:
    Stripe.Checkout.Session
) {
  if (
    session.payment_status !==
    "paid"
  ) {
    return;
  }

  const unitId =
    session.metadata
      ?.split_payment_unit_id
      ?.trim();

  if (!unitId) {
    throw new Error(
      "Split payment unit metadata manquante."
    );
  }

  const unit =
    await getUnit(
      unitId
    );

  if (
    unit.status ===
    "paid"
  ) {
    await refreshRunPaymentStatus(
      unit.run_id
    );
    return;
  }

  if (
    unit.stripe_checkout_session_id &&
    unit.stripe_checkout_session_id !==
      session.id
  ) {
    throw new Error(
      "Session Stripe split incohérente."
    );
  }

  if (
    session.amount_total !==
      null &&
    Number(
      session.amount_total
    ) !==
      Number(
        unit.amount_cents
      )
  ) {
    throw new Error(
      "Montant Stripe split incohérent."
    );
  }

  if (
    session.currency &&
    session.currency.toUpperCase() !==
      unit.currency.toUpperCase()
  ) {
    throw new Error(
      "Devise Stripe split incohérente."
    );
  }

  const bookings =
    await getBookingsForUnit(
      unit
    );

  const grossTotal =
    bookings.reduce(
      (
        total,
        booking
      ) =>
        total +
        bookingAmount(
          booking
        ),
      0
    );

  if (
    grossTotal !==
    Number(
      unit.amount_cents
    )
  ) {
    throw new Error(
      "Total des réservations split incohérent."
    );
  }

  const paymentIntentId =
    paymentIntentIdFromSession(
      session
    );

  let remainingFee =
    Number(
      unit.application_fee_amount
    );

  const now =
    new Date()
      .toISOString();

  for (
    let index = 0;
    index < bookings.length;
    index += 1
  ) {
    const booking =
      bookings[index];

    const gross =
      bookingAmount(
        booking
      );

    const fee =
      index ===
      bookings.length - 1
        ? remainingFee
        : Math.min(
            remainingFee,
            Math.round(
              Number(
                unit.application_fee_amount
              ) *
                (
                  gross /
                  grossTotal
                )
            )
          );

    remainingFee -=
      fee;

    const providerAmount =
      Math.max(
        gross -
          fee,
        0
      );

    const {
      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "bookings"
        )
        .update({
          payment_status:
            "paid",

          payment_mode:
            "connect_destination_split",

          stripe_checkout_session_id:
            session.id,

          /*
           * Le même PaymentIntent Stripe couvre
           * plusieurs child bookings.
           * Il reste donc au niveau de l'unité split.
           */
          stripe_payment_intent_id:
            null,

          application_fee_amount:
            fee,

          platform_fee_amount:
            fee,

          provider_amount:
            providerAmount,

          payment_attempt_token:
            null,

          payment_checkout_started_at:
            null,

          payment_failure_code:
            null,

          payment_failure_message:
            null,

          payment_failed_at:
            null,

          paid_at:
            now,
        })
        .eq(
          "id",
          booking.id
        )
        .neq(
          "payment_status",
          "paid"
        );

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    await upsertFinancialLedgerEntry({
      bookingId:
        booking.id,

      entryKey:
        "booking:" +
        booking.id +
        ":split-payment:" +
        session.id,

      entryType:
        "payment_succeeded",

      status:
        "succeeded",

      currency:
        booking.currency ??
        unit.currency,

      grossAmountCents:
        gross,

      platformFeeCents:
        fee,

      providerAmountCents:
        providerAmount,

      paymentMode:
        "connect_destination_split",

      stripeCheckoutSessionId:
        session.id,

      stripePaymentIntentId:
        paymentIntentId,
    });
  }

  const {
    error:
      unitError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .update({
        status:
          "paid",

        stripe_checkout_session_id:
          session.id,

        stripe_payment_intent_id:
          paymentIntentId,

        checkout_url:
          null,

        last_error:
          null,

        paid_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        unit.id
      )
      .neq(
        "status",
        "paid"
      );

  if (unitError) {
    throw new Error(
      unitError.message
    );
  }

  await refreshRunPaymentStatus(
    unit.run_id
  );
}

async function markFailed(
  unitId:
    string,

  checkoutSessionId:
    string | null,

  paymentIntentId:
    string | null,

  message:
    string
) {
  const unit =
    await getUnit(
      unitId
    );

  if (
    unit.status ===
    "paid"
  ) {
    return;
  }

  if (
    checkoutSessionId &&
    unit.stripe_checkout_session_id &&
    checkoutSessionId !==
      unit.stripe_checkout_session_id
  ) {
    return;
  }

  const now =
    new Date()
      .toISOString();

  const {
    error:
      unitError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .update({
        status:
          "failed",

        stripe_payment_intent_id:
          paymentIntentId,

        checkout_url:
          null,

        last_error:
          message.slice(
            0,
            1000
          ),

        updated_at:
          now,
      })
      .eq(
        "id",
        unit.id
      )
      .neq(
        "status",
        "paid"
      );

  if (unitError) {
    throw new Error(
      unitError.message
    );
  }

  const bookingIds =
    strings(
      unit.booking_ids
    );

  if (
    bookingIds.length >
    0
  ) {
    const {
      error,
    } =
      await supabaseAdmin
        .from(
          "bookings"
        )
        .update({
          payment_status:
            "failed",

          payment_failure_code:
            "split_payment_failed",

          payment_failure_message:
            message.slice(
              0,
              1000
            ),

          payment_failed_at:
            now,
        })
        .in(
          "id",
          bookingIds
        )
        .neq(
          "payment_status",
          "paid"
        );

    if (error) {
      throw new Error(
        error.message
      );
    }
  }

  await refreshRunPaymentStatus(
    unit.run_id
  );
}

async function markExpired(
  unitId:
    string,

  sessionId:
    string
) {
  const unit =
    await getUnit(
      unitId
    );

  if (
    unit.status ===
    "paid"
  ) {
    return;
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .update({
        status:
          "expired",

        checkout_url:
          null,

        last_error:
          "checkout_expired",

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        unit.id
      )
      .eq(
        "stripe_checkout_session_id",
        sessionId
      )
      .neq(
        "status",
        "paid"
      );

  if (error) {
    throw new Error(
      error.message
    );
  }

  await refreshRunPaymentStatus(
    unit.run_id
  );
}

async function allocateRefundLedger(
  refund:
    Stripe.Refund,

  unit:
    UnitRow,

  status:
    "processing" |
    "succeeded" |
    "failed"
) {
  const bookings =
    await getBookingsForUnit(
      unit
    );

  const grossTotal =
    bookings.reduce(
      (
        total,
        booking
      ) =>
        total +
        bookingAmount(
          booking
        ),
      0
    );

  if (
    grossTotal !==
    Number(
      unit.amount_cents
    )
  ) {
    throw new Error(
      "Total child bookings incohérent pour le remboursement split."
    );
  }

  let remaining =
    refund.amount;

  for (
    let index = 0;
    index < bookings.length;
    index += 1
  ) {
    const booking =
      bookings[index];

    const gross =
      bookingAmount(
        booking
      );

    const allocated =
      index ===
      bookings.length - 1
        ? remaining
        : Math.min(
            remaining,
            Math.round(
              refund.amount *
                (
                  gross /
                  grossTotal
                )
            )
          );

    remaining -=
      allocated;

    await upsertFinancialLedgerEntry({
      bookingId:
        booking.id,

      entryKey:
        "booking:" +
        booking.id +
        ":split-refund:" +
        refund.id,

      entryType:
        status ===
        "failed"
          ? "refund_failed"
          : "refund_succeeded",

      status:
        status,

      currency:
        booking.currency ??
        unit.currency,

      grossAmountCents:
        gross,

      refundAmountCents:
        allocated,

      paymentMode:
        "connect_destination_split",

      stripeCheckoutSessionId:
        unit.stripe_checkout_session_id,

      stripePaymentIntentId:
        paymentIntentIdFromRefund(
          refund
        ),

      stripeRefundId:
        refund.id,

      failureCode:
        status ===
        "failed"
          ? refund.failure_reason ??
            "refund_failed"
          : null,

      failureMessage:
        status ===
        "failed"
          ? "Stripe n'a pas finalisé le remboursement split."
          : null,
    });
  }
}

async function updateBookingRefundSnapshots(
  unit:
    UnitRow,

  succeededTotal:
    number,

  latestRefundId:
    string,

  aggregateStatus:
    string
) {
  const bookings =
    await getBookingsForUnit(
      unit
    );

  const grossTotal =
    bookings.reduce(
      (
        total,
        booking
      ) =>
        total +
        bookingAmount(
          booking
        ),
      0
    );

  let remaining =
    succeededTotal;

  for (
    let index = 0;
    index < bookings.length;
    index += 1
  ) {
    const booking =
      bookings[index];

    const gross =
      bookingAmount(
        booking
      );

    const proportional =
      index ===
      bookings.length - 1
        ? remaining
        : Math.min(
            remaining,
            Math.round(
              succeededTotal *
                (
                  gross /
                  grossTotal
                )
            )
          );

    remaining -=
      proportional;

    let bookingRefundStatus =
      "processing";

    if (
      aggregateStatus ===
      "failed"
    ) {
      bookingRefundStatus =
        "failed";
    }
    else if (
      proportional >
      0
    ) {
      bookingRefundStatus =
        "succeeded";
    }

    const {
      error,
    } =
      await supabaseAdmin
        .from(
          "bookings"
        )
        .update({
          refund_status:
            bookingRefundStatus,

          stripe_refund_id:
            latestRefundId,

          refunded_amount_cents:
            proportional,

          refunded_at:
            proportional >
            0
              ? new Date()
                  .toISOString()
              : null,
        })
        .eq(
          "id",
          booking.id
        );

    if (error) {
      throw new Error(
        error.message
      );
    }
  }
}

export async function reconcileSplitStripeRefund(
  refund:
    Stripe.Refund
): Promise<boolean> {
  const unit =
    await findUnitForRefund(
      refund
    );

  if (!unit) {
    return false;
  }

  if (
    refund.currency.toUpperCase() !==
    unit.currency.toUpperCase()
  ) {
    throw new Error(
      "Devise du remboursement split incohérente."
    );
  }

  const status =
    refundState(
      refund
    );

  const {
    error:
      upsertError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_refunds"
      )
      .upsert(
        {
          unit_id:
            unit.id,

          run_id:
            unit.run_id,

          batch_id:
            unit.batch_id,

          stripe_refund_id:
            refund.id,

          stripe_payment_intent_id:
            paymentIntentIdFromRefund(
              refund
            ),

          amount_cents:
            refund.amount,

          currency:
            refund.currency.toUpperCase(),

          status,

          raw_status:
            refund.status,

          failure_reason:
            refund.failure_reason ??
            null,

          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "stripe_refund_id",
        }
      );

  if (upsertError) {
    throw new Error(
      upsertError.message
    );
  }

  await allocateRefundLedger(
    refund,
    unit,
    status
  );

  const {
    data:
      refundRowsData,

    error:
      refundRowsError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_refunds"
      )
      .select(
        "stripe_refund_id, amount_cents, status"
      )
      .eq(
        "unit_id",
        unit.id
      );

  if (refundRowsError) {
    throw new Error(
      refundRowsError.message
    );
  }

  const refundRows =
    (
      refundRowsData ??
      []
    ) as unknown as
      RefundRow[];

  const succeededTotal =
    refundRows
      .filter(
        (
          row
        ) =>
          row.status ===
          "succeeded"
      )
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.amount_cents
          ),
        0
      );

  if (
    succeededTotal >
    Number(
      unit.amount_cents
    )
  ) {
    throw new Error(
      "Remboursement split supérieur au montant original."
    );
  }

  const processingExists =
    refundRows.some(
      (
        row
      ) =>
        row.status ===
        "processing"
    );

  const failedExists =
    refundRows.some(
      (
        row
      ) =>
        row.status ===
        "failed"
    );

  let unitRefundStatus =
    "none";

  if (
    succeededTotal ===
    Number(
      unit.amount_cents
    )
  ) {
    unitRefundStatus =
      "refunded";
  }
  else if (
    succeededTotal >
    0
  ) {
    unitRefundStatus =
      "partially_refunded";
  }
  else if (
    processingExists
  ) {
    unitRefundStatus =
      "processing";
  }
  else if (
    failedExists
  ) {
    unitRefundStatus =
      "failed";
  }

  const {
    error:
      unitError,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .update({
        refund_status:
          unitRefundStatus,

        refunded_amount_cents:
          succeededTotal,

        stripe_refund_id:
          refund.id,

        refund_failure_reason:
          status ===
          "failed"
            ? refund.failure_reason ??
              "refund_failed"
            : null,

        refund_updated_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        unit.id
      );

  if (unitError) {
    throw new Error(
      unitError.message
    );
  }

  await updateBookingRefundSnapshots(
    unit,
    succeededTotal,
    refund.id,
    unitRefundStatus
  );

  await refreshRunPaymentStatus(
    unit.run_id
  );

  return true;
}

export async function handleSplitStripeWebhookEvent(
  stripe:
    Stripe,

  event:
    Stripe.Event
): Promise<boolean> {
  if (
    event.type ===
      "checkout.session.completed" ||
    event.type ===
      "checkout.session.async_payment_succeeded"
  ) {
    const session =
      event.data.object as
        Stripe.Checkout.Session;

    if (
      session.metadata
        ?.klyx_flow !==
      "split_payment_13_27"
    ) {
      return false;
    }

    await markPaid(
      session
    );

    return true;
  }

  if (
    event.type ===
    "checkout.session.async_payment_failed"
  ) {
    const session =
      event.data.object as
        Stripe.Checkout.Session;

    if (
      session.metadata
        ?.klyx_flow !==
      "split_payment_13_27"
    ) {
      return false;
    }

    const unitId =
      session.metadata
        ?.split_payment_unit_id
        ?.trim();

    if (!unitId) {
      throw new Error(
        "Split payment unit metadata manquante."
      );
    }

    await markFailed(
      unitId,
      session.id,
      paymentIntentIdFromSession(
        session
      ),
      "Le paiement Stripe de cette partie de mission a échoué."
    );

    return true;
  }

  if (
    event.type ===
    "checkout.session.expired"
  ) {
    const session =
      event.data.object as
        Stripe.Checkout.Session;

    if (
      session.metadata
        ?.klyx_flow !==
      "split_payment_13_27"
    ) {
      return false;
    }

    const unitId =
      session.metadata
        ?.split_payment_unit_id
        ?.trim();

    if (!unitId) {
      throw new Error(
        "Split payment unit metadata manquante."
      );
    }

    await markExpired(
      unitId,
      session.id
    );

    return true;
  }

  if (
    event.type ===
    "payment_intent.payment_failed"
  ) {
    const intent =
      event.data.object as
        Stripe.PaymentIntent;

    if (
      intent.metadata
        ?.klyx_flow !==
      "split_payment_13_27"
    ) {
      return false;
    }

    const unitId =
      intent.metadata
        ?.split_payment_unit_id
        ?.trim();

    if (!unitId) {
      throw new Error(
        "Split payment unit metadata manquante."
      );
    }

    const sessions =
      await stripe.checkout.sessions.list({
        payment_intent:
          intent.id,

        limit:
          1,
      });

    await markFailed(
      unitId,
      sessions.data[0]
        ?.id ??
        null,
      intent.id,
      intent.last_payment_error
        ?.message ??
        "Le paiement Stripe a été refusé."
    );

    return true;
  }

  // KLYX_SPLIT_REFUND_WEBHOOK_13_28
  if (
    event.type ===
      "refund.created" ||
    event.type ===
      "refund.updated" ||
    event.type ===
      "refund.failed"
  ) {
    const refund =
      event.data.object as
        Stripe.Refund;

    return reconcileSplitStripeRefund(
      refund
    );
  }

  if (
    event.type ===
    "charge.refunded"
  ) {
    const charge =
      event.data.object as
        Stripe.Charge;

    let handled =
      false;

    for (
      const refund
      of charge.refunds
        ?.data ??
        []
    ) {
      const thisRefundHandled =
        await reconcileSplitStripeRefund(
          refund
        );

      handled =
        handled ||
        thisRefundHandled;
    }

    return handled;
  }

  return false;
}