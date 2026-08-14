import "server-only";

import type Stripe from "stripe";

import {
  upsertFinancialLedgerEntry,
} from "@/lib/payment-ledger";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_GROUP_REFUND_HELPER_12_90

type GroupRow = {
  id: string;
  market_request_id: string | null;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  payment_mode: string | null;
  total_amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  cancellation_resolved_by: string | null;
};

type ChildRow = {
  id: string;
  status: string;
  amount_total: number | null;
  currency: string | null;
  payment_mode: string | null;
};

function refundIntentId(
  refund: Stripe.Refund
): string | null {
  return typeof refund.payment_intent ===
    "string"
    ? refund.payment_intent
    : refund.payment_intent?.id ??
        null;
}

async function findGroup(
  refund: Stripe.Refund
): Promise<GroupRow | null> {
  const metadataId =
    refund.metadata
      ?.booking_group_id
      ?.trim() ??
    "";

  if (metadataId) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("booking_groups")
      .select(
        "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, payment_mode, total_amount_cents, currency, stripe_payment_intent_id, stripe_refund_id, cancellation_resolved_by"
      )
      .eq(
        "id",
        metadataId
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (data) {
      return data as unknown as GroupRow;
    }
  }

  const paymentIntentId =
    refundIntentId(
      refund
    );

  if (!paymentIntentId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("booking_groups")
    .select(
      "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, payment_mode, total_amount_cents, currency, stripe_payment_intent_id, stripe_refund_id, cancellation_resolved_by"
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
    ? data as unknown as GroupRow
    : null;
}

async function loadChildren(
  groupId: string
): Promise<ChildRow[]> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, status, amount_total, currency, payment_mode"
    )
    .eq(
      "booking_group_id",
      groupId
    )
    .order(
      "group_position",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return (
    data ??
    []
  ) as unknown as ChildRow[];
}

function normalizeRefundStatus(
  refund: Stripe.Refund
) {
  if (
    refund.status ===
    "succeeded"
  ) {
    return "refunded";
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

async function notify(
  params: {
    group: GroupRow;
    userId: string;
    bookingId: string | null;
    title: string;
    message: string;
    key: string;
  }
) {
  const {
    error,
  } = await supabaseAdmin
    .from(
      "user_notifications"
    )
    .upsert(
      {
        user_id:
          params.userId,

        booking_id:
          params.bookingId,

        market_request_id:
          params.group
            .market_request_id,

        type:
          "system",

        title:
          params.title,

        message:
          params.message,

        href:
          "/booking-groups/" +
          params.group.id,

        deduplication_key:
          params.key,
      },
      {
        onConflict:
          "deduplication_key",

        ignoreDuplicates:
          true,
      }
    );

  if (error) {
    console.error(
      "Group refund notification:",
      error.message
    );
  }
}

export async function tryReconcileBookingGroupStripeRefund(
  refund: Stripe.Refund
): Promise<boolean> {
  const group =
    await findGroup(
      refund
    );

  if (!group) {
    return false;
  }

  const state =
    normalizeRefundStatus(
      refund
    );

  const now =
    new Date()
      .toISOString();

  if (
    state ===
      "refunded" &&
    refund.amount !==
      Number(
        group.total_amount_cents
      )
  ) {
    throw new Error(
      "KLYX refuse un remboursement partiel sur une mission groupee."
    );
  }

  const {
    error:
      groupError,
  } = await supabaseAdmin
    .from(
      "booking_groups"
    )
    .update({
      stripe_refund_id:
        refund.id,

      refund_status:
        state,

      refunded_amount_cents:
        refund.amount,

      refunded_at:
        state ===
        "refunded"
          ? now
          : null,

      ...(state ===
      "refunded"
        ? {
            status:
              "cancelled",

            payment_status:
              "refunded",
          }
        : {}),

      updated_at:
        now,
    })
    .eq(
      "id",
      group.id
    );

  if (groupError) {
    throw new Error(
      groupError.message
    );
  }

  const children =
    await loadChildren(
      group.id
    );

  const firstBookingId =
    children[0]?.id ??
    null;

  if (
    state ===
    "refunded"
  ) {
    const actorId =
      group.cancellation_resolved_by ??
      group.client_profile_id;

    const events =
      children
        .filter(
          (child) =>
            ![
              "cancelled",
              "rejected",
            ].includes(
              child.status
            )
        )
        .map(
          (child) => ({
            booking_id:
              child.id,

            actor_id:
              actorId,

            previous_status:
              child.status,

            new_status:
              "cancelled",

            note:
              "Mission groupee annulee apres remboursement Stripe unique.",
          })
        );

    if (
      events.length > 0
    ) {
      const {
        error:
          eventError,
      } = await supabaseAdmin
        .from(
          "booking_status_events"
        )
        .insert(
          events
        );

      if (eventError) {
        throw new Error(
          eventError.message
        );
      }
    }

    let distributed =
      0;

    const groupTotal =
      Number(
        group.total_amount_cents
      );

    for (
      let index = 0;
      index <
      children.length;
      index += 1
    ) {
      const child =
        children[index];

      const gross =
        Number(
          child.amount_total ??
          0
        );

      const share =
        index ===
        children.length - 1
          ? Math.max(
              refund.amount -
                distributed,
              0
            )
          : groupTotal > 0
            ? Math.floor(
                refund.amount *
                  gross /
                  groupTotal
              )
            : 0;

      distributed +=
        share;

      const {
        error:
          childError,
      } = await supabaseAdmin
        .from("bookings")
        .update({
          status:
            "cancelled",

          service_status:
            "cancelled",

          refund_status:
            "succeeded",

          stripe_refund_id:
            refund.id,

          refunded_amount_cents:
            share,

          refunded_at:
            now,

          updated_at:
            now,
        })
        .eq(
          "id",
          child.id
        );

      if (childError) {
        throw new Error(
          childError.message
        );
      }

      await upsertFinancialLedgerEntry({
        bookingId:
          child.id,

        entryKey:
          "booking:" +
          child.id +
          ":group-refund:" +
          refund.id,

        entryType:
          "refund_succeeded",

        status:
          "succeeded",

        currency:
          child.currency ??
          group.currency,

        grossAmountCents:
          gross,

        refundAmountCents:
          share,

        paymentMode:
          child.payment_mode ??
          group.payment_mode,

        stripePaymentIntentId:
          refundIntentId(
            refund
          ) ??
          group.stripe_payment_intent_id,

        stripeRefundId:
          refund.id,
      });
    }

    const amountLabel =
      (
        refund.amount /
        100
      ).toFixed(
        2
      ) +
      " " +
      (
        group.currency ||
        "EUR"
      ).toUpperCase();

    await Promise.all([
      notify({
        group,

        userId:
          group.client_profile_id,

        bookingId:
          firstBookingId,

        title:
          "Mission groupee remboursee",

        message:
          "Stripe a confirme le remboursement unique de " +
          amountLabel +
          " pour toute la mission.",

        key:
          "booking-group:" +
          group.id +
          ":refund-success:client",
      }),

      notify({
        group,

        userId:
          group.provider_profile_id,

        bookingId:
          firstBookingId,

        title:
          "Mission groupee annulee",

        message:
          "Le remboursement groupe a ete confirme. Tous les creneaux sont annules.",

        key:
          "booking-group:" +
          group.id +
          ":refund-success:provider",
      }),
    ]);

    await supabaseAdmin
      .from(
        "booking_group_cancellation_events"
      )
      .insert({
        booking_group_id:
          group.id,

        actor_profile_id:
          actorId,

        actor_role:
          "system",

        action:
          "refund_succeeded",

        reason:
          "Remboursement Stripe groupe confirme.",
      });

    return true;
  }

  if (
    state ===
    "failed"
  ) {
    const failure =
      refund.failure_reason ||
      "Stripe n a pas finalise le remboursement groupe.";

    await Promise.all([
      notify({
        group,

        userId:
          group.client_profile_id,

        bookingId:
          firstBookingId,

        title:
          "Remboursement groupe a verifier",

        message:
          failure,

        key:
          "booking-group:" +
          group.id +
          ":refund-failed:client",
      }),

      notify({
        group,

        userId:
          group.provider_profile_id,

        bookingId:
          firstBookingId,

        title:
          "Remboursement groupe a verifier",

        message:
          failure,

        key:
          "booking-group:" +
          group.id +
          ":refund-failed:provider",
      }),
    ]);

    await supabaseAdmin
      .from(
        "booking_group_cancellation_events"
      )
      .insert({
        booking_group_id:
          group.id,

        actor_profile_id:
          group.cancellation_resolved_by ??
          group.client_profile_id,

        actor_role:
          "system",

        action:
          "refund_failed",

        reason:
          failure,
      });
  }

  return true;
}