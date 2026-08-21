import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

async function requestJson({
  appOrigin,
  accessToken,
  profileId,
  path,
  method,
  body,
  headers = {},
  expectedStatuses = [200],
}) {
  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  if (profileId) {
    requestHeaders.Cookie = `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`;
  }

  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });

  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(
        `${method} ${path} returned non-JSON status ${response.status}.`
      );
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";
    throw new Error(
      `${method} ${path} returned ${response.status}: ${safeMessage}`
    );
  }

  return payload;
}

function signedStripeEvent(payload, webhookSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify(payload);
  const digest = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${raw}`, "utf8")
    .digest("hex");

  return {
    raw,
    signature: `t=${timestamp},v1=${digest}`,
  };
}

async function postSignedWebhook({ appOrigin, webhookSecret, event }) {
  const signed = signedStripeEvent(event, webhookSecret);

  return requestJson({
    appOrigin,
    path: "/api/stripe/webhook",
    method: "POST",
    body: signed.raw,
    headers: {
      "stripe-signature": signed.signature,
    },
  });
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Stripe refund network proof is allowed only with ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Stripe refund network proof requires the isolated local KLYX server on 127.0.0.1:3100."
    );
  }

  const stripeSecretKey = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const stripePublishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  );
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");

  if (
    !stripeSecretKey.startsWith("sk_test_") ||
    !stripePublishableKey.startsWith("pk_test_")
  ) {
    throw new Error("Stripe refund network proof requires test-mode Stripe keys only.");
  }

  if (
    process.env.KLYX_STRIPE_MODE !== "test" ||
    process.env.KLYX_LIVE_PAYMENTS_ENABLED !== "false" ||
    process.env.KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS !== "true"
  ) {
    throw new Error("Stripe refund network proof runtime is not test-only.");
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate the Stripe refund network proof account.");
  }

  const accessToken = signInData.session.access_token;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(
      `Unable to load Stripe refund proof profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error("Stripe refund proof client/provider profiles are missing.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, status, payment_status, service_status, amount_total, currency, payment_mode, stripe_checkout_session_id"
    )
    .eq("parent_id", client.id)
    .eq("provider_id", provider.id)
    .eq("status", "accepted")
    .eq("payment_status", "checkout_created")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error(
      `Unable to locate Stripe-network checkout booking: ${
        bookingError?.message ?? "missing booking"
      }`
    );
  }

  if (
    booking.service_status !== "scheduled" ||
    Number(booking.amount_total) !== 7000 ||
    booking.currency !== "EUR" ||
    booking.payment_mode !== "platform_test_only" ||
    typeof booking.stripe_checkout_session_id !== "string" ||
    !booking.stripe_checkout_session_id.startsWith("cs_test_")
  ) {
    throw new Error("Booking is not ready for Stripe test payment/refund proof.");
  }

  const stripe = new Stripe(stripeSecretKey);
  const nonce = randomUUID().replaceAll("-", "");

  const intent = await stripe.paymentIntents.create(
    {
      amount: 7000,
      currency: "eur",
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      metadata: {
        booking_id: booking.id,
        provider_id: provider.id,
        payment_mode: "platform_test_only",
        klyx_network_proof: "refund",
      },
    },
    {
      idempotencyKey: `klyx-network-payment-${booking.id}`,
    }
  );

  if (
    intent.livemode !== false ||
    intent.status !== "succeeded" ||
    intent.amount !== 7000 ||
    intent.currency !== "eur"
  ) {
    throw new Error(
      `Stripe test PaymentIntent did not succeed safely: ${intent.status}.`
    );
  }

  const checkoutEventId = `evt_test_klyx_network_checkout_${nonce}`;
  const checkoutEvent = {
    id: checkoutEventId,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: booking.stripe_checkout_session_id,
        object: "checkout.session",
        amount_total: 7000,
        currency: "eur",
        metadata: {
          booking_id: booking.id,
          provider_id: provider.id,
          payment_mode: "platform_test_only",
        },
        mode: "payment",
        payment_intent: intent.id,
        payment_status: "paid",
        status: "complete",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  };

  const paidWebhook = await postSignedWebhook({
    appOrigin,
    webhookSecret,
    event: checkoutEvent,
  });

  if (
    paidWebhook?.received !== true ||
    paidWebhook?.duplicate !== false ||
    paidWebhook?.eventId !== checkoutEventId
  ) {
    throw new Error("KLYX did not process the signed test payment webhook.");
  }

  const { data: paidBooking, error: paidBookingError } = await admin
    .from("bookings")
    .select(
      "id, status, payment_status, service_status, amount_total, currency, payment_mode, stripe_payment_intent_id, paid_at"
    )
    .eq("id", booking.id)
    .single();

  if (paidBookingError) {
    throw new Error(
      `Unable to verify paid booking before refund: ${paidBookingError.message}`
    );
  }

  if (
    paidBooking.status !== "accepted" ||
    paidBooking.payment_status !== "paid" ||
    paidBooking.service_status !== "scheduled" ||
    Number(paidBooking.amount_total) !== 7000 ||
    paidBooking.currency !== "EUR" ||
    paidBooking.payment_mode !== "platform_test_only" ||
    paidBooking.stripe_payment_intent_id !== intent.id ||
    !paidBooking.paid_at
  ) {
    throw new Error("KLYX did not persist the expected paid test state.");
  }

  const cancellation = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/status",
    method: "POST",
    body: {
      bookingId: booking.id,
      status: "cancelled",
      note: "Stripe test network refund proof before service start.",
    },
  });

  if (
    cancellation?.status !== "cancelled" ||
    cancellation?.refunded !== true
  ) {
    throw new Error("KLYX did not launch refund from the real cancellation API.");
  }

  const { data: refundedBooking, error: refundedBookingError } = await admin
    .from("bookings")
    .select(
      "id, status, payment_status, service_status, amount_total, currency, payment_mode, refund_status, stripe_refund_id, refunded_amount_cents, refunded_at"
    )
    .eq("id", booking.id)
    .single();

  if (refundedBookingError) {
    throw new Error(
      `Unable to verify refunded booking: ${refundedBookingError.message}`
    );
  }

  if (
    refundedBooking.status !== "cancelled" ||
    refundedBooking.payment_status !== "refunded" ||
    refundedBooking.service_status !== "cancelled" ||
    refundedBooking.refund_status !== "succeeded" ||
    Number(refundedBooking.refunded_amount_cents) !== 7000 ||
    refundedBooking.currency !== "EUR" ||
    refundedBooking.payment_mode !== "platform_test_only" ||
    typeof refundedBooking.stripe_refund_id !== "string" ||
    !refundedBooking.stripe_refund_id.startsWith("re_") ||
    !refundedBooking.refunded_at
  ) {
    throw new Error("KLYX refund state is not canonically terminal/refunded.");
  }

  const remoteRefund = await stripe.refunds.retrieve(
    refundedBooking.stripe_refund_id
  );

  const remoteRefundIntentId =
    typeof remoteRefund.payment_intent === "string"
      ? remoteRefund.payment_intent
      : remoteRefund.payment_intent?.id ?? null;

  if (
    remoteRefund.livemode !== false ||
    remoteRefund.status !== "succeeded" ||
    remoteRefund.amount !== 7000 ||
    remoteRefund.currency !== "eur" ||
    remoteRefundIntentId !== intent.id
  ) {
    throw new Error("Remote Stripe test refund does not match KLYX state.");
  }

  const refundEventId = `evt_test_klyx_network_refund_${nonce}`;
  const refundEvent = {
    id: refundEventId,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: { object: remoteRefund },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "refund.updated",
  };

  const refundWebhook = await postSignedWebhook({
    appOrigin,
    webhookSecret,
    event: refundEvent,
  });

  if (
    refundWebhook?.received !== true ||
    refundWebhook?.duplicate !== false ||
    refundWebhook?.eventId !== refundEventId
  ) {
    throw new Error("KLYX did not reconcile the signed test refund webhook.");
  }

  const duplicateRefundWebhook = await postSignedWebhook({
    appOrigin,
    webhookSecret,
    event: refundEvent,
  });

  if (
    duplicateRefundWebhook?.received !== true ||
    duplicateRefundWebhook?.duplicate !== true ||
    duplicateRefundWebhook?.eventId !== refundEventId
  ) {
    throw new Error("KLYX refund webhook replay protection failed.");
  }

  const { data: ledger, error: ledgerError } = await admin
    .from("booking_financial_ledger")
    .select(
      "entry_type, status, currency, gross_amount_cents, refund_amount_cents, payment_mode, stripe_payment_intent_id, stripe_refund_id"
    )
    .eq("booking_id", booking.id)
    .in("entry_type", ["payment_succeeded", "refund_succeeded"])
    .order("created_at", { ascending: true });

  if (ledgerError) {
    throw new Error(`Unable to verify refund ledger: ${ledgerError.message}`);
  }

  const paymentEntry = (ledger ?? []).find(
    (entry) => entry.entry_type === "payment_succeeded"
  );
  const refundEntry = (ledger ?? []).find(
    (entry) => entry.entry_type === "refund_succeeded"
  );

  if (
    !paymentEntry ||
    paymentEntry.status !== "succeeded" ||
    paymentEntry.currency !== "EUR" ||
    Number(paymentEntry.gross_amount_cents) !== 7000 ||
    paymentEntry.payment_mode !== "platform_test_only" ||
    paymentEntry.stripe_payment_intent_id !== intent.id ||
    !refundEntry ||
    refundEntry.status !== "succeeded" ||
    refundEntry.currency !== "EUR" ||
    Number(refundEntry.refund_amount_cents) !== 7000 ||
    refundEntry.payment_mode !== "platform_test_only" ||
    refundEntry.stripe_payment_intent_id !== intent.id ||
    refundEntry.stripe_refund_id !== remoteRefund.id
  ) {
    throw new Error("KLYX payment/refund ledger is not canonical after refund.");
  }

  const finance = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/provider/finance",
    method: "GET",
  });

  if (
    finance?.summary?.currency !== "EUR" ||
    Number(finance?.summary?.grossPaidCents) !== 7000 ||
    Number(finance?.summary?.refundedCents) !== 7000 ||
    Number(finance?.summary?.refundsProcessingCents) !== 0 ||
    Number(finance?.summary?.successfulPayments) !== 1 ||
    Number(finance?.summary?.successfulRefunds) !== 1 ||
    finance?.automaticExecutionAllowed !== false
  ) {
    throw new Error(
      `Provider finance did not reconcile the refund: ${JSON.stringify(finance?.summary)}`
    );
  }

  fs.mkdirSync("stripe-network-proof", { recursive: true });
  fs.writeFileSync(
    "stripe-network-proof/refund-proof.json",
    `${JSON.stringify(
      {
        verified: true,
        stripeNetwork: true,
        livemode: false,
        paymentIntentStatus: intent.status,
        refundStatus: remoteRefund.status,
        amountTotal: 7000,
        refundedAmount: 7000,
        currency: "EUR",
        paymentMode: "platform_test_only",
        bookingPaymentStatus: refundedBooking.payment_status,
        refundWebhookReplayProtected: true,
        localSignedWebhookDelivery: true,
        realStripeHostedWebhookDeliveryClaimed: false,
        realMoneyMoved: false,
        payoutClaimed: false,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      verified: true,
      stripeTestPaymentIntent: true,
      stripeTestRefund: true,
      livemode: false,
      amountTotal: 7000,
      refundedAmount: 7000,
      currency: "EUR",
      bookingPaymentStatus: "refunded",
      refundWebhookReplayProtected: true,
      localSignedWebhookDelivery: true,
      realStripeHostedWebhookDeliveryClaimed: false,
      realMoneyMoved: false,
      payoutClaimed: false,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Stripe refund network proof failed: ${message}`);
  process.exitCode = 1;
});
