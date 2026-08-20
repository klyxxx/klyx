import { createHmac, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

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

  return { status: response.status, payload };
}

function stripeSignature(payload, webhookSecret, timestamp) {
  const digest = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}

function brusselsDateOffset(days) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const anchor = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + days,
      12,
      0,
      0
    )
  );

  return anchor.toISOString().slice(0, 10);
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path service lifecycle is allowed only on ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Golden-path service lifecycle requires the isolated local KLYX server on 127.0.0.1:3100."
    );
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate the golden-path KLYX account.");
  }

  const accessToken = signInData.session.access_token;
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(
      `Unable to load golden-path profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error("Golden-path client/provider profiles are missing.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, status, payment_status, service_status, amount_total, currency, created_at"
    )
    .eq("parent_id", client.id)
    .eq("provider_id", provider.id)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error(
      `Unable to locate accepted golden-path booking: ${
        bookingError?.message ?? "missing booking"
      }`
    );
  }

  if (
    Number(booking.amount_total) !== 7000 ||
    booking.currency !== "EUR" ||
    booking.service_status !== "scheduled"
  ) {
    throw new Error(
      "Golden-path booking is not ready for payment lifecycle proof."
    );
  }

  const nonce = randomUUID().replaceAll("-", "");
  const eventId = `evt_test_klyx_${nonce}`;
  const sessionId = `cs_test_klyx_${nonce}`;
  const paymentIntentId = `pi_klyx_${nonce}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const event = {
    id: eventId,
    object: "event",
    created: timestamp,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        amount_total: 7000,
        currency: "eur",
        metadata: {
          booking_id: booking.id,
        },
        mode: "payment",
        payment_intent: paymentIntentId,
        payment_status: "paid",
        status: "complete",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: "checkout.session.completed",
  };
  const rawEvent = JSON.stringify(event);
  const signature = stripeSignature(rawEvent, webhookSecret, timestamp);

  const webhook = await requestJson({
    appOrigin,
    path: "/api/stripe/webhook",
    method: "POST",
    body: rawEvent,
    headers: {
      "stripe-signature": signature,
    },
  });

  if (
    webhook.payload?.received !== true ||
    webhook.payload?.duplicate !== false ||
    webhook.payload?.eventId !== eventId
  ) {
    throw new Error(
      "Signed local Stripe webhook was not processed as a new event."
    );
  }

  const duplicateWebhook = await requestJson({
    appOrigin,
    path: "/api/stripe/webhook",
    method: "POST",
    body: rawEvent,
    headers: {
      "stripe-signature": signature,
    },
  });

  if (
    duplicateWebhook.payload?.received !== true ||
    duplicateWebhook.payload?.duplicate !== true ||
    duplicateWebhook.payload?.eventId !== eventId
  ) {
    throw new Error("Stripe webhook replay was not rejected idempotently.");
  }

  const { data: paidBooking, error: paidBookingError } = await admin
    .from("bookings")
    .select(
      "id, status, payment_status, service_status, amount_total, currency, stripe_checkout_session_id, stripe_payment_intent_id, paid_at"
    )
    .eq("id", booking.id)
    .single();

  if (paidBookingError) {
    throw new Error(
      `Unable to verify paid booking: ${paidBookingError.message}`
    );
  }

  if (
    paidBooking.status !== "accepted" ||
    paidBooking.payment_status !== "paid" ||
    paidBooking.service_status !== "scheduled" ||
    Number(paidBooking.amount_total) !== 7000 ||
    paidBooking.currency !== "EUR" ||
    paidBooking.stripe_checkout_session_id !== sessionId ||
    paidBooking.stripe_payment_intent_id !== paymentIntentId ||
    !paidBooking.paid_at
  ) {
    throw new Error(
      "Signed webhook did not persist the expected paid booking state."
    );
  }

  const { data: ledger, error: ledgerError } = await admin
    .from("booking_financial_ledger")
    .select(
      "entry_type, status, currency, gross_amount_cents, platform_fee_cents, payment_mode, stripe_checkout_session_id, stripe_payment_intent_id"
    )
    .eq("booking_id", booking.id)
    .eq("entry_type", "payment_succeeded")
    .single();

  if (ledgerError) {
    throw new Error(
      `Unable to verify payment ledger: ${ledgerError.message}`
    );
  }

  if (
    ledger.status !== "succeeded" ||
    ledger.currency !== "EUR" ||
    Number(ledger.gross_amount_cents) !== 7000 ||
    Number(ledger.platform_fee_cents) !== 0 ||
    ledger.payment_mode !== "platform_test_only" ||
    ledger.stripe_checkout_session_id !== sessionId ||
    ledger.stripe_payment_intent_id !== paymentIntentId
  ) {
    throw new Error("Golden-path financial ledger entry is invalid.");
  }

  const { data: webhookRecord, error: webhookRecordError } = await admin
    .from("stripe_webhook_events")
    .select(
      "stripe_event_id, event_type, object_id, livemode, status, attempt_count"
    )
    .eq("stripe_event_id", eventId)
    .single();

  if (webhookRecordError) {
    throw new Error(
      `Unable to verify webhook idempotency record: ${webhookRecordError.message}`
    );
  }

  if (
    webhookRecord.event_type !== "checkout.session.completed" ||
    webhookRecord.object_id !== sessionId ||
    webhookRecord.livemode !== false ||
    webhookRecord.status !== "processed" ||
    Number(webhookRecord.attempt_count) !== 1
  ) {
    throw new Error("Golden-path webhook processing record is invalid.");
  }

  const paymentNotificationKeys = [
    `booking:${booking.id}:payment-success:client`,
    `booking:${booking.id}:payment-success:provider`,
  ];
  const { data: paymentNotifications, error: paymentNotificationsError } =
    await admin
      .from("user_notifications")
      .select("deduplication_key")
      .in("deduplication_key", paymentNotificationKeys);

  if (paymentNotificationsError) {
    throw new Error(
      `Unable to verify payment notifications: ${paymentNotificationsError.message}`
    );
  }

  const notificationKeys = new Set(
    (paymentNotifications ?? []).map((item) => item.deduplication_key)
  );

  for (const key of paymentNotificationKeys) {
    if (!notificationKeys.has(key)) {
      throw new Error(`Missing payment notification ${key}.`);
    }
  }

  // KLYX_GOLDEN_PATH_TEMPORAL_GUARD_PROBE
  const prematureTracking = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/bookings/tracking",
    method: "POST",
    expectedStatuses: [409],
    body: {
      bookingId: booking.id,
      action: "en_route",
      note: "Golden path premature tracking probe.",
    },
  });

  if (
    typeof prematureTracking.payload?.error !== "string" ||
    !prematureTracking.payload.error.includes("jour prévu")
  ) {
    throw new Error(
      "Future booking tracking was not blocked by the temporal guard."
    );
  }

  const historicalDate = brusselsDateOffset(-1);
  const { error: timeFixtureError } = await admin
    .from("bookings")
    .update({
      booking_date: historicalDate,
      start_time: "10:00",
      end_time: "12:00",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("payment_status", "paid");

  if (timeFixtureError) {
    throw new Error(
      `Unable to move the ephemeral booking into the service window: ${timeFixtureError.message}`
    );
  }

  for (const action of ["en_route", "arrived", "in_progress"]) {
    await requestJson({
      appOrigin,
      accessToken,
      profileId: provider.id,
      path: "/api/bookings/tracking",
      method: "POST",
      body: {
        bookingId: booking.id,
        action,
        note: `Golden path ${action}.`,
      },
    });
  }

  await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/bookings/tracking",
    method: "POST",
    body: {
      bookingId: booking.id,
      action: "provider_finished",
      note: "Golden path provider finished the mission.",
    },
  });

  const completion = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/tracking",
    method: "POST",
    body: {
      bookingId: booking.id,
      action: "client_confirmed",
      note: "Golden path client confirmed completion.",
    },
  });

  if (completion.payload?.serviceStatus !== "completed") {
    throw new Error(
      "Client confirmation did not complete the golden-path mission."
    );
  }

  const reviewResponse = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/reviews",
    method: "POST",
    body: {
      bookingId: booking.id,
      rating: 5,
      comment:
        "Golden path KLYX: mission terminée et vérifiée de bout en bout.",
    },
  });

  if (
    reviewResponse.payload?.review?.rating !== 5 ||
    reviewResponse.payload?.providerId !== provider.id
  ) {
    throw new Error("Golden-path review API response is invalid.");
  }

  const loadedReview = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: `/api/reviews?bookingId=${encodeURIComponent(booking.id)}`,
    method: "GET",
  });

  if (loadedReview.payload?.review?.rating !== 5) {
    throw new Error(
      "Golden-path review could not be read back through the API."
    );
  }

  const { data: completedBooking, error: completedBookingError } = await admin
    .from("bookings")
    .select(
      "status, payment_status, service_status, provider_finished_at, client_confirmed_at, completed_at"
    )
    .eq("id", booking.id)
    .single();

  if (completedBookingError) {
    throw new Error(
      `Unable to verify completed booking: ${completedBookingError.message}`
    );
  }

  if (
    completedBooking.status !== "completed" ||
    completedBooking.payment_status !== "paid" ||
    completedBooking.service_status !== "completed" ||
    !completedBooking.provider_finished_at ||
    !completedBooking.client_confirmed_at ||
    !completedBooking.completed_at
  ) {
    throw new Error("Golden-path booking completion state is invalid.");
  }

  const { data: review, error: reviewError } = await admin
    .from("reviews")
    .select("booking_id, author_id, target_id, rating, comment")
    .eq("booking_id", booking.id)
    .eq("author_id", client.id)
    .single();

  if (reviewError) {
    throw new Error(
      `Unable to verify persisted review: ${reviewError.message}`
    );
  }

  if (
    review.target_id !== provider.id ||
    Number(review.rating) !== 5 ||
    !review.comment?.includes("Golden path KLYX")
  ) {
    throw new Error("Golden-path persisted review is invalid.");
  }

  const { data: trackingEvents, error: trackingEventsError } = await admin
    .from("booking_tracking_events")
    .select("status")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true });

  if (trackingEventsError) {
    throw new Error(
      `Unable to verify tracking events: ${trackingEventsError.message}`
    );
  }

  const trackingStatuses = (trackingEvents ?? []).map(
    (eventRow) => eventRow.status
  );

  for (const status of ["en_route", "arrived", "in_progress", "completed"]) {
    if (!trackingStatuses.includes(status)) {
      throw new Error(`Golden-path tracking history is missing ${status}.`);
    }
  }

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      syntheticStripeWebhookVerified: true,
      webhookReplayProtected: true,
      paymentStatus: completedBooking.payment_status,
      bookingStatus: completedBooking.status,
      serviceStatus: completedBooking.service_status,
      ledgerStatus: ledger.status,
      reviewRating: Number(review.rating),
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path service lifecycle failed: ${message}`);
  process.exitCode = 1;
});
