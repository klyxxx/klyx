import "server-only";

import type Stripe from "stripe";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";
import {
  calculateKlyxEconomics,
  getKlyxCommissionPercent,
} from "@/lib/klyx-economics";
import type {
  PaymentFailureDetails,
} from "@/lib/stripe-payments";

// KLYX_GROUP_STRIPE_HELPER_12_86
// KLYX_GROUP_PAYMENT_RETRY_REPAIR_16_08
// KLYX_GROUP_REFUNDED_TERMINAL_GUARD_16_10

type GroupRow = {
  id: string;
  market_request_id: string;
  client_profile_id: string;
  provider_profile_id: string;
  status: string;
  payment_status: string;
  total_amount_cents: number;
  currency: string;
  payment_mode: string | null;
  application_fee_amount: number | null;
  platform_fee_amount: number | null;
  provider_amount: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

type ChildBooking = {
  id: string;
  amount_total: number | null;
  currency: string | null;
  currency_code: string | null;
};

type GroupPaymentEconomics = {
  amountTotal: number;
  paymentMode: string;
  platformFee: number;
  providerAmount: number | null;
};

const groupSelection =
  "id, market_request_id, client_profile_id, provider_profile_id, status, payment_status, total_amount_cents, currency, payment_mode, application_fee_amount, platform_fee_amount, provider_amount, stripe_checkout_session_id, stripe_payment_intent_id";

function paymentIntentId(
  session: Stripe.Checkout.Session
): string | null {
  if (
    typeof session.payment_intent ===
    "string"
  ) {
    return session.payment_intent;
  }

  return (
    session.payment_intent?.id ??
    null
  );
}

// KLYX_GROUP_CURRENCY_INTEGRITY_14_26
function normalizeGroupCurrency(
  value: string | null | undefined
): string {
  const currency =
    value
      ?.trim()
      .toUpperCase() ??
    "";

  if (
    !/^[A-Z]{3}$/.test(
      currency
    )
  ) {
    throw new Error(
      "Devise du groupe KLYX invalide ou absente."
    );
  }

  return currency;
}

function groupCurrencyCode(
  group: GroupRow
): string {
  return normalizeGroupCurrency(
    group.currency
  );
}

function childCurrencyCode(
  child: ChildBooking,
  fallback: string
): string {
  const raw =
    child.currency_code ??
    child.currency;

  if (!raw) {
    return fallback;
  }

  return normalizeGroupCurrency(
    raw
  );
}

function formatGroupAmount(
  amountCents: number,
  currency: string
): string {
  return new Intl.NumberFormat(
    "fr",
    {
      style: "currency",
      currency,
    }
  ).format(
    amountCents / 100
  );
}

async function findGroupFromSession(
  session: Stripe.Checkout.Session
): Promise<GroupRow> {
  const metadataId =
    session.metadata
      ?.booking_group_id ??
    null;

  if (metadataId) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("booking_groups")
      .select(groupSelection)
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
      return data as GroupRow;
    }
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("booking_groups")
    .select(groupSelection)
    .eq(
      "stripe_checkout_session_id",
      session.id
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!data) {
    throw new Error(
      "Reservation groupee Stripe introuvable."
    );
  }

  return data as GroupRow;
}

async function findGroupFromIntent(
  intent: Stripe.PaymentIntent
): Promise<GroupRow> {
  const metadataId =
    intent.metadata
      ?.booking_group_id ??
    null;

  if (metadataId) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("booking_groups")
      .select(groupSelection)
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
      return data as GroupRow;
    }
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("booking_groups")
    .select(groupSelection)
    .eq(
      "stripe_payment_intent_id",
      intent.id
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!data) {
    throw new Error(
      "Paiement groupe Stripe introuvable."
    );
  }

  return data as GroupRow;
}

function verifySession(
  group: GroupRow,
  session: Stripe.Checkout.Session
) {
  if (
    group.stripe_checkout_session_id &&
    group.stripe_checkout_session_id !==
      session.id
  ) {
    throw new Error(
      "La session Stripe ne correspond pas au groupe."
    );
  }

  if (
    session.amount_total != null &&
    Number(
      group.total_amount_cents
    ) !== session.amount_total
  ) {
    throw new Error(
      "Le montant Stripe ne correspond pas au groupe."
    );
  }

  const currency =
    groupCurrencyCode(
      group
    ).toLowerCase();

  if (
    session.currency &&
    session.currency !==
      currency
  ) {
    throw new Error(
      "La devise Stripe ne correspond pas au groupe."
    );
  }

  const incomingIntent =
    paymentIntentId(
      session
    );

  if (
    group.stripe_payment_intent_id &&
    incomingIntent &&
    group.stripe_payment_intent_id !==
      incomingIntent
  ) {
    throw new Error(
      "Le paiement Stripe ne correspond pas au groupe."
    );
  }
}

async function children(
  groupId: string
): Promise<ChildBooking[]> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, amount_total, currency, currency_code"
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
  ) as ChildBooking[];
}

async function notification(
  params: {
    group: GroupRow;
    bookingId: string | null;
    userId: string;
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
          "payment_received",
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
    throw new Error(
      error.message
    );
  }
}

function groupPaymentEconomics(
  group: GroupRow
): GroupPaymentEconomics {
  const amountTotal =
    Number(
      group.total_amount_cents
    );

  if (
    amountTotal <= 0
  ) {
    throw new Error(
      "Montant groupe invalide."
    );
  }

  const paymentMode =
    group.payment_mode ??
    "platform_test_only";

  const economics =
    calculateKlyxEconomics(
      amountTotal,
      getKlyxCommissionPercent()
    );

  const platformFee =
    paymentMode ===
    "connect_destination"
      ? group.application_fee_amount ??
        economics.platformFeeCents
      : 0;

  const providerAmount =
    paymentMode ===
    "connect_destination"
      ? Math.max(
          amountTotal -
            platformFee,
          0
        )
      : null;

  return {
    amountTotal,
    paymentMode,
    platformFee,
    providerAmount,
  };
}

function validateChildCurrencies(
  childRows: ChildBooking[],
  canonicalGroupCurrency: string
) {
  for (
    const child
    of childRows
  ) {
    const childCurrency =
      childCurrencyCode(
        child,
        canonicalGroupCurrency
      );

    if (
      childCurrency !==
      canonicalGroupCurrency
    ) {
      throw new Error(
        "La devise d'une réservation ne correspond pas à la devise du groupe."
      );
    }
  }
}

async function upsertGroupPaymentLedgers(
  params: {
    childRows: ChildBooking[];
    session: Stripe.Checkout.Session;
    incomingIntent: string | null;
    canonicalGroupCurrency: string;
    economics: GroupPaymentEconomics;
  }
) {
  let distributedFee = 0;

  for (
    let index = 0;
    index <
    params.childRows.length;
    index += 1
  ) {
    const child =
      params.childRows[index];

    const gross =
      Number(
        child.amount_total ??
        0
      );

    const fee =
      index ===
      params.childRows.length - 1
        ? Math.max(
            params.economics.platformFee -
              distributedFee,
            0
          )
        : params.economics.amountTotal > 0
          ? Math.floor(
              params.economics.platformFee *
                gross /
                params.economics.amountTotal
            )
          : 0;

    distributedFee +=
      fee;

    const childProviderAmount =
      params.economics.paymentMode ===
      "connect_destination"
        ? Math.max(
            gross - fee,
            0
          )
        : null;

    await upsertFinancialLedgerEntry({
      bookingId:
        child.id,
      entryKey:
        "booking:" +
        child.id +
        ":group-payment:" +
        params.session.id,
      entryType:
        "payment_succeeded",
      status:
        "succeeded",
      currency:
        childCurrencyCode(
          child,
          params.canonicalGroupCurrency
        ),
      grossAmountCents:
        gross,
      platformFeeCents:
        fee,
      providerAmountCents:
        childProviderAmount,
      paymentMode:
        params.economics.paymentMode,
      stripeCheckoutSessionId:
        params.session.id,
      stripePaymentIntentId:
        params.incomingIntent,
    });
  }
}

export async function markBookingGroupPaidFromSession(
  session: Stripe.Checkout.Session
) {
  const group =
    await findGroupFromSession(
      session
    );

  verifySession(
    group,
    session
  );

  if (
    session.payment_status !==
    "paid"
  ) {
    throw new Error(
      "Stripe n a pas confirme le paiement groupe."
    );
  }

  const economics =
    groupPaymentEconomics(
      group
    );

  const incomingIntent =
    paymentIntentId(
      session
    );

  const childRows =
    await children(
      group.id
    );

  if (
    childRows.length === 0
  ) {
    throw new Error(
      "Les reservations du groupe sont introuvables."
    );
  }

  // KLYX_GROUP_CHILD_CURRENCY_GUARD_14_26
  const canonicalGroupCurrency =
    groupCurrencyCode(
      group
    );

  validateChildCurrencies(
    childRows,
    canonicalGroupCurrency
  );

  if (
    group.payment_status ===
    "refunded"
  ) {
    await upsertGroupPaymentLedgers({
      childRows,
      session,
      incomingIntent,
      canonicalGroupCurrency,
      economics,
    });

    return;
  }

  const now =
    new Date()
      .toISOString();

  if (
    group.payment_status !==
    "paid"
  ) {
    const {
      data: transition,
      error,
    } = await supabaseAdmin
      .from("booking_groups")
      .update({
        payment_status:
          "paid",
        stripe_checkout_session_id:
          session.id,
        stripe_payment_intent_id:
          incomingIntent,
        application_fee_amount:
          economics.platformFee,
        platform_fee_amount:
          economics.platformFee,
        provider_amount:
          economics.providerAmount,
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
        updated_at:
          now,
      })
      .eq(
        "id",
        group.id
      )
      .neq(
        "payment_status",
        "paid"
      )
      .neq(
        "payment_status",
        "refunded"
      )
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (!transition) {
      const currentGroup =
        await findGroupFromSession(
          session
        );

      if (
        currentGroup.payment_status ===
        "refunded"
      ) {
        await upsertGroupPaymentLedgers({
          childRows,
          session,
          incomingIntent,
          canonicalGroupCurrency,
          economics,
        });

        return;
      }

      if (
        currentGroup.payment_status !==
        "paid"
      ) {
        throw new Error(
          "Etat de paiement groupe modifie pendant la confirmation Stripe."
        );
      }
    }
  }

  const {
    error:
      childrenUpdateError,
  } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status:
        "paid",
      payment_mode:
        economics.paymentMode,
      paid_at:
        now,
      updated_at:
        now,
    })
    .eq(
      "booking_group_id",
      group.id
    )
    .neq(
      "payment_status",
      "paid"
    )
    .neq(
      "payment_status",
      "refunded"
    );

  if (
    childrenUpdateError
  ) {
    throw new Error(
      childrenUpdateError
        .message
    );
  }

  await upsertGroupPaymentLedgers({
    childRows,
    session,
    incomingIntent,
    canonicalGroupCurrency,
    economics,
  });

  const finalGroup =
    await findGroupFromSession(
      session
    );

  if (
    finalGroup.payment_status ===
    "refunded"
  ) {
    return;
  }

  if (
    finalGroup.payment_status !==
    "paid"
  ) {
    throw new Error(
      "Le groupe n est plus dans un etat de paiement finalisable."
    );
  }

  const firstChild =
    childRows[0]?.id ??
    null;

  await Promise.all([
    notification({
      group:
        finalGroup,
      bookingId:
        firstChild,
      userId:
        finalGroup.client_profile_id,
      title:
        "Paiement groupe confirme",
      message:
        "Le paiement unique de " +
        formatGroupAmount(
          economics.amountTotal,
          canonicalGroupCurrency
        ) +
        " couvre tous les creneaux.",
      key:
        "booking-group:" +
        finalGroup.id +
        ":payment-success:client",
    }),

    notification({
      group:
        finalGroup,
      bookingId:
        firstChild,
      userId:
        finalGroup.provider_profile_id,
      title:
        "Paiement groupe recu",
      message:
        "Le paiement de la reservation groupee est confirme.",
      key:
        "booking-group:" +
        finalGroup.id +
        ":payment-success:provider",
    }),
  ]);
}

export async function markBookingGroupFailedFromSession(
  session: Stripe.Checkout.Session,
  failure: PaymentFailureDetails
) {
  const group =
    await findGroupFromSession(
      session
    );

  verifySession(
    group,
    session
  );

  if (
    group.payment_status ===
      "paid" ||
    group.payment_status ===
      "refunded"
  ) {
    return;
  }

  const now =
    new Date()
      .toISOString();

  const {
    data: transition,
    error,
  } = await supabaseAdmin
    .from("booking_groups")
    .update({
      payment_status:
        "failed",
      stripe_payment_intent_id:
        paymentIntentId(
          session
        ),
      payment_attempt_token:
        null,
      payment_checkout_started_at:
        null,
      payment_failure_code:
        failure.code,
      payment_failure_message:
        failure.message,
      payment_failed_at:
        now,
      updated_at:
        now,
    })
    .eq(
      "id",
      group.id
    )
    .eq(
      "stripe_checkout_session_id",
      session.id
    )
    .neq(
      "payment_status",
      "paid"
    )
    .neq(
      "payment_status",
      "refunded"
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!transition) {
    return;
  }

  const childRows =
    await children(
      group.id
    );

  await notification({
    group,
    bookingId:
      childRows[0]?.id ??
      null,
    userId:
      group.client_profile_id,
    title:
      "Paiement groupe refuse",
    message:
      failure.message,
    key:
      "booking-group:" +
      group.id +
      ":payment-failed:" +
      (
        paymentIntentId(
          session
        ) ??
        session.id
      ),
  });
}

export async function recordBookingGroupPaymentFailure(
  intent: Stripe.PaymentIntent,
  checkoutSessionId:
    string | null
) {
  const group =
    await findGroupFromIntent(
      intent
    );

  if (
    group.payment_status ===
      "paid" ||
    group.payment_status ===
      "refunded"
  ) {
    return;
  }

  if (
    group.stripe_checkout_session_id &&
    checkoutSessionId &&
    group.stripe_checkout_session_id !==
      checkoutSessionId
  ) {
    return;
  }

  const failureCode =
    intent.last_payment_error
      ?.decline_code ||
    intent.last_payment_error
      ?.code ||
    "payment_failed";

  const failureMessage =
    intent.last_payment_error
      ?.message ||
    "Le paiement groupe a ete refuse. Aucun montant n a ete debite.";

  const now =
    new Date()
      .toISOString();

  const {
    error,
  } = await supabaseAdmin
    .from("booking_groups")
    .update({
      stripe_payment_intent_id:
        intent.id,
      payment_failure_code:
        failureCode,
      payment_failure_message:
        failureMessage,
      payment_failed_at:
        now,
      updated_at:
        now,
    })
    .eq(
      "id",
      group.id
    )
    .neq(
      "payment_status",
      "paid"
    )
    .neq(
      "payment_status",
      "refunded"
    );

  if (error) {
    throw new Error(
      error.message
    );
  }
}
