import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { upsertFinancialLedgerEntry } from "@/lib/payment-ledger";

type BookingPaymentRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  currency_code: string | null;
  payment_mode: string | null;
  application_fee_amount: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
};

export type PaymentFailureDetails = {
  code: string;
  message: string;
};

const bookingSelection =
  "id, parent_id, provider_id, babysitter_id, payment_status, amount_total, currency, currency_code, payment_mode, application_fee_amount, stripe_checkout_session_id, stripe_payment_intent_id";

const FAILURE_MESSAGES: Record<string, string> = {
  insufficient_funds:
    "Le paiement a été refusé car le solde disponible est insuffisant.",
  expired_card:
    "Le paiement a été refusé car la carte est expirée.",
  incorrect_cvc:
    "Le paiement a été refusé car le code de sécurité de la carte est incorrect.",
  incorrect_number:
    "Le paiement a été refusé car le numéro de carte est incorrect.",
  invalid_number:
    "Le paiement a été refusé car le numéro de carte est invalide.",
  invalid_expiry_month:
    "Le paiement a été refusé car le mois d’expiration est invalide.",
  invalid_expiry_year:
    "Le paiement a été refusé car l’année d’expiration est invalide.",
  authentication_required:
    "Le paiement a été refusé car l’authentification bancaire n’a pas été validée.",
  card_not_supported:
    "Le paiement a été refusé car cette carte n’est pas compatible avec cette opération.",
  currency_not_supported:
    "Le paiement a été refusé car la carte ne prend pas en charge cette devise.",
  processing_error:
    "La banque n’a pas pu traiter le paiement. Aucun montant n’a été débité.",
  card_declined:
    "Le paiement a été refusé par la banque. Contacte ta banque ou utilise un autre moyen de paiement.",
  do_not_honor:
    "Le paiement a été refusé par la banque. Contacte ta banque ou utilise un autre moyen de paiement.",
  generic_decline:
    "Le paiement a été refusé par la banque. Contacte ta banque ou utilise un autre moyen de paiement.",
  lost_card:
    "Le paiement a été refusé par la banque. Utilise un autre moyen de paiement.",
  stolen_card:
    "Le paiement a été refusé par la banque. Utilise un autre moyen de paiement.",
};

function getCommissionPercent(): number {
  const value = Number(process.env.KLYX_COMMISSION_PERCENT || "15");

  if (Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error(
      "KLYX_COMMISSION_PERCENT doit être compris entre 0 et 100."
    );
  }

  return value;
}

function paymentIntentId(
  session: Stripe.Checkout.Session
): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id ?? null;
}

// KLYX_PAYMENT_CURRENCY_INTEGRITY_14_26
function normalizeKlyxPaymentCurrency(
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
      "Devise KLYX invalide ou absente."
    );
  }

  return currency;
}

function bookingCurrencyCode(
  booking: BookingPaymentRow
): string {
  return normalizeKlyxPaymentCurrency(
    booking.currency_code ??
    booking.currency
  );
}
function formatAmount(
  amount: number,
  currency: string | null
): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: normalizeKlyxPaymentCurrency(currency),
  }).format(amount / 100);
}

async function createPaymentNotification(params: {
  userId: string;
  bookingId: string;
  type: string;
  title: string;
  message: string;
  deduplicationKey: string;
  replaceExisting?: boolean;
}) {
  const { error } = await supabaseAdmin
    .from("user_notifications")
    .upsert(
      {
        user_id: params.userId,
        booking_id: params.bookingId,
        type: params.type,
        title: params.title,
        message: params.message,
        href: `/bookings/${params.bookingId}`,
        deduplication_key: params.deduplicationKey,
      },
      {
        onConflict: "deduplication_key",
        ignoreDuplicates: !params.replaceExisting,
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function findBooking(
  session: Stripe.Checkout.Session
): Promise<BookingPaymentRow> {
  const bookingId = session.metadata?.booking_id ?? null;

  if (bookingId) {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(bookingSelection)
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as BookingPaymentRow;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(bookingSelection)
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      `Aucune réservation trouvée pour la session Stripe ${session.id}.`
    );
  }

  return data as BookingPaymentRow;
}

async function findBookingFromPaymentIntent(
  intent: Stripe.PaymentIntent
): Promise<BookingPaymentRow> {
  const bookingId = intent.metadata?.booking_id ?? null;

  if (bookingId) {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(bookingSelection)
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as BookingPaymentRow;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(bookingSelection)
    .eq("stripe_payment_intent_id", intent.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      `Aucune réservation trouvée pour le paiement Stripe ${intent.id}.`
    );
  }

  return data as BookingPaymentRow;
}

function verifySessionMatchesBooking(
  booking: BookingPaymentRow,
  session: Stripe.Checkout.Session
) {
  if (
    booking.stripe_checkout_session_id &&
    booking.stripe_checkout_session_id !== session.id
  ) {
    throw new Error(
      "La session Stripe ne correspond pas à cette réservation."
    );
  }

  if (
    booking.amount_total != null &&
    session.amount_total != null &&
    booking.amount_total !== session.amount_total
  ) {
    throw new Error(
      "Le montant Stripe ne correspond pas à la réservation."
    );
  }

  const expectedCurrency = bookingCurrencyCode(booking).toLowerCase();

  if (
    session.currency &&
    session.currency !== expectedCurrency
  ) {
    throw new Error(
      "La devise Stripe ne correspond pas à la réservation."
    );
  }

  const incomingPaymentIntentId =
    paymentIntentId(session);

  if (
    booking.stripe_payment_intent_id &&
    incomingPaymentIntentId &&
    booking.stripe_payment_intent_id !==
      incomingPaymentIntentId
  ) {
    throw new Error(
      "Cette réservation possède déjà un autre paiement Stripe."
    );
  }
}

function verifyIntentMatchesBooking(
  booking: BookingPaymentRow,
  intent: Stripe.PaymentIntent
) {
  if (
    booking.amount_total != null &&
    booking.amount_total !== intent.amount
  ) {
    throw new Error(
      "Le montant Stripe ne correspond pas à la réservation."
    );
  }

  const expectedCurrency = bookingCurrencyCode(booking).toLowerCase();

  if (intent.currency !== expectedCurrency) {
    throw new Error(
      "La devise Stripe ne correspond pas à la réservation."
    );
  }

  if (
    booking.stripe_payment_intent_id &&
    booking.stripe_payment_intent_id !== intent.id
  ) {
    throw new Error(
      "Cette réservation possède déjà un autre paiement Stripe."
    );
  }
}

async function notifyPaymentSucceeded(
  booking: BookingPaymentRow
) {
  const amount = booking.amount_total ?? 0;
  const amountLabel =
    amount > 0
      ? formatAmount(amount, bookingCurrencyCode(booking))
      : null;

  const providerId =
    booking.provider_id ?? booking.babysitter_id;

  const notifications = [
    createPaymentNotification({
      userId: booking.parent_id,
      bookingId: booking.id,
      type: "payment_received",
      title: "Paiement effectué avec succès",
      message: amountLabel
        ? `Ton paiement de ${amountLabel} a été confirmé.`
        : "Ton paiement a été confirmé.",
      deduplicationKey:
        `booking:${booking.id}:payment-success:client`,
    }),
  ];

  if (providerId) {
    notifications.push(
      createPaymentNotification({
        userId: providerId,
        bookingId: booking.id,
        type: "payment_received",
        title: "Paiement reçu avec succès",
        message: amountLabel
          ? `Le paiement de ${amountLabel} pour cette réservation est confirmé.`
          : "Le paiement de cette réservation est confirmé.",
        deduplicationKey:
          `booking:${booking.id}:payment-success:provider`,
      })
    );
  }

  await Promise.all(notifications);
}

export function getPaymentFailureDetails(
  intent: Stripe.PaymentIntent
): PaymentFailureDetails {
  const lastError = intent.last_payment_error;

  const code =
    lastError?.decline_code ||
    lastError?.code ||
    "payment_failed";

  const message =
    FAILURE_MESSAGES[code] ||
    (lastError?.code
      ? FAILURE_MESSAGES[lastError.code]
      : undefined) ||
    "Le paiement a été refusé. Aucun montant n’a été débité. Vérifie ton moyen de paiement.";

  return {
    code,
    message,
  };
}

export async function markBookingPaidFromSession(
  session: Stripe.Checkout.Session
) {
  const booking = await findBooking(session);

  verifySessionMatchesBooking(
    booking,
    session
  );

  if (session.payment_status !== "paid") {
    throw new Error(
      "Stripe n'a pas confirmé le paiement."
    );
  }

  if (booking.payment_status === "paid") {
    await notifyPaymentSucceeded(booking);
    return;
  }

  const amountTotal =
    booking.amount_total ??
    session.amount_total ??
    0;

  if (amountTotal <= 0) {
    throw new Error(
      "Montant total de la réservation invalide."
    );
  }

  const paymentMode =
    booking.payment_mode ??
    "platform_test_only";

  const calculatedFee = Math.round(
    amountTotal *
      (getCommissionPercent() / 100)
  );

  const platformFeeAmount =
    paymentMode === "connect_destination"
      ? booking.application_fee_amount ??
        calculatedFee
      : 0;

  const providerAmount =
    paymentMode === "connect_destination"
      ? Math.max(
          amountTotal - platformFeeAmount,
          0
        )
      : null;

  const {
    data: updatedBooking,
    error,
  } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: "paid",
      amount_total: amountTotal,
      application_fee_amount:
        platformFeeAmount,
      platform_fee_amount:
        platformFeeAmount,
      provider_amount: providerAmount,
      stripe_checkout_session_id:
        session.id,
      stripe_payment_intent_id:
        paymentIntentId(session),
      payment_attempt_token: null,
      payment_checkout_started_at: null,
      payment_failure_code: null,
      payment_failure_message: null,
      payment_failed_at: null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .neq("payment_status", "paid")
    .select(bookingSelection)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (updatedBooking) {
    await upsertFinancialLedgerEntry({
      bookingId: booking.id,
      entryKey:
        `booking:${booking.id}:payment:${session.id}`,
      entryType:
        "payment_succeeded",
      status: "succeeded",
      currency: bookingCurrencyCode(booking),
      grossAmountCents: amountTotal,
      platformFeeCents:
        platformFeeAmount,
      providerAmountCents:
        providerAmount,
      paymentMode,
      stripeCheckoutSessionId:
        session.id,
      stripePaymentIntentId:
        paymentIntentId(session),
    });

    await notifyPaymentSucceeded(
      updatedBooking as BookingPaymentRow
    );

    return;
  }

  const refreshedBooking =
    await findBooking(session);

  if (
    refreshedBooking.payment_status ===
    "paid"
  ) {
    await notifyPaymentSucceeded(
      refreshedBooking
    );
  }
}

export async function recordBookingPaymentFailure(
  intent: Stripe.PaymentIntent,
  checkoutSessionId: string | null
) {
  const booking =
    await findBookingFromPaymentIntent(
      intent
    );

  if (
    booking.payment_status !==
      "checkout_created" ||
    (
      booking.stripe_checkout_session_id &&
      checkoutSessionId &&
      booking.stripe_checkout_session_id !==
        checkoutSessionId
    ) ||
    (
      booking.stripe_payment_intent_id &&
      booking.stripe_payment_intent_id !==
        intent.id
    )
  ) {
    return;
  }

  verifyIntentMatchesBooking(
    booking,
    intent
  );

  const failure =
    getPaymentFailureDetails(intent);

  const now =
    new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      stripe_payment_intent_id:
        intent.id,
      payment_failure_code:
        failure.code,
      payment_failure_message:
        failure.message,
      payment_failed_at: now,
    })
    .eq("id", booking.id)
    .neq("payment_status", "paid");

  if (error) {
    throw new Error(error.message);
  }

  await upsertFinancialLedgerEntry({
    bookingId: booking.id,
    entryKey:
      `booking:${booking.id}:payment-failed:${intent.id}`,
    entryType: "payment_failed",
    status: "failed",
    currency: bookingCurrencyCode(booking),
    grossAmountCents: intent.amount,
    paymentMode:
      booking.payment_mode,
    stripeCheckoutSessionId:
      checkoutSessionId,
    stripePaymentIntentId:
      intent.id,
    failureCode:
      failure.code,
    failureMessage:
      failure.message,
  });

  await createPaymentNotification({
    userId: booking.parent_id,
    bookingId: booking.id,
    type: "system",
    title: "Paiement refusé",
    message: failure.message,
    deduplicationKey:
      `booking:${booking.id}:payment-failed:${intent.id}`,
    replaceExisting: true,
  });
}

export async function markBookingFailedFromSession(
  session: Stripe.Checkout.Session,
  failure: PaymentFailureDetails = {
    code: "payment_failed",
    message:
      "Le paiement a été refusé. Aucun montant n’a été débité. Vérifie ton moyen de paiement.",
  }
) {
  const booking =
    await findBooking(session);

  verifySessionMatchesBooking(
    booking,
    session
  );

  if (
    booking.payment_status === "paid"
  ) {
    return;
  }

  const incomingPaymentIntentId =
    paymentIntentId(session);

  const now =
    new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: "failed",
      stripe_payment_intent_id:
        incomingPaymentIntentId ??
        booking.stripe_payment_intent_id,
      payment_attempt_token: null,
      payment_checkout_started_at: null,
      payment_failure_code:
        failure.code,
      payment_failure_message:
        failure.message,
      payment_failed_at: now,
    })
    .eq("id", booking.id)
    .eq(
      "stripe_checkout_session_id",
      session.id
    )
    .neq("payment_status", "paid");

  if (error) {
    throw new Error(error.message);
  }

  await upsertFinancialLedgerEntry({
    bookingId: booking.id,
    entryKey:
      `booking:${booking.id}:payment-failed:${incomingPaymentIntentId ?? session.id}`,
    entryType: "payment_failed",
    status: "failed",
    currency: bookingCurrencyCode(booking),
    grossAmountCents:
      session.amount_total ??
      booking.amount_total ??
      0,
    paymentMode:
      booking.payment_mode,
    stripeCheckoutSessionId:
      session.id,
    stripePaymentIntentId:
      incomingPaymentIntentId,
    failureCode:
      failure.code,
    failureMessage:
      failure.message,
  });

  await createPaymentNotification({
    userId: booking.parent_id,
    bookingId: booking.id,
    type: "system",
    title: "Paiement refusé",
    message: failure.message,
    deduplicationKey:
      `booking:${booking.id}:payment-failed:${incomingPaymentIntentId ?? session.id}`,
    replaceExisting: true,
  });
}
