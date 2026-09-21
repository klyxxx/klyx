// Mission 19 local-only settlement eligibility chaos proof.
// Runs only against ephemeral local Supabase. It creates no Stripe object and
// performs no external money movement.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function rpcRow(data, label) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) {
    throw new Error(`${label} returned ${rows.length} rows instead of 1.`);
  }
  return rows[0];
}

function futureBrusselsDate(daysAhead) {
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
  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + daysAhead,
      12
    )
  ).toISOString().slice(0, 10);
}

async function requestJson({
  appOrigin,
  accessToken,
  profileId,
  path,
  method,
  body,
}) {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;
  if (response.status !== 200) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${payload?.error ?? "unexpected response"}`
    );
  }
  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  invariant(localSupabase, "Mission 19 settlement proof requires local Supabase.");

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  invariant(
    appOrigin === "http://127.0.0.1:3100",
    "Mission 19 settlement proof requires the isolated KLYX server."
  );

  const admin = createClient(
    e2eOrigin,
    requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const userClient = createClient(
    e2eOrigin,
    requiredGoldenPathEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: signIn, error: signInError } =
    await userClient.auth.signInWithPassword({
      email: requiredGoldenPathEnv("KLYX_E2E_EMAIL"),
      password: requiredGoldenPathEnv("KLYX_E2E_PASSWORD"),
    });
  if (signInError || !signIn.session?.access_token || !signIn.user) {
    throw new Error(`Mission 19 auth failed: ${signInError?.message ?? "missing session"}`);
  }

  const accessToken = signIn.session.access_token;
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_id, owner_user_id, account_type")
    .eq("owner_user_id", signIn.user.id);
  if (profilesError) throw new Error(profilesError.message);

  const client = (profiles ?? []).find((p) => p.account_type === "client");
  const provider = (profiles ?? []).find((p) => p.account_type === "provider");
  invariant(client?.id && provider?.id, "Mission 19 profiles missing.");

  let accountId = provider.account_id;
  if (!accountId) {
    const { data: account, error } = await admin
      .from("accounts")
      .select("id")
      .eq("auth_user_id", provider.owner_user_id)
      .single();
    if (error) throw new Error(error.message);
    accountId = account.id;
  }

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, service_id, services(slug)")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true)
    .maybeSingle();
  if (userServiceError || !userService) {
    throw new Error(userServiceError?.message ?? "Mission 19 service missing.");
  }
  const relation = Array.isArray(userService.services)
    ? userService.services[0]
    : userService.services;
  invariant(relation?.slug, "Mission 19 service slug missing.");

  const created = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/create",
    method: "POST",
    body: {
      providerId: provider.id,
      serviceSlug: relation.slug,
      bookingDate: futureBrusselsDate(21),
      startTime: "10:00",
      endTime: "12:00",
      message: "Mission 19 settlement authorization fixture.",
    },
  });
  const bookingId = created?.bookingId;
  invariant(typeof bookingId === "string", "Mission 19 booking creation failed.");

  await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/bookings/status",
    method: "POST",
    body: {
      bookingId,
      status: "accepted",
      note: "Mission 19 settlement authorization fixture accepted.",
    },
  });

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, amount_total, currency, status, payment_status, booking_group_id")
    .eq("id", bookingId)
    .single();
  if (bookingError) throw new Error(bookingError.message);
  invariant(
    booking.status === "accepted" &&
      booking.payment_status === "unpaid" &&
      booking.booking_group_id === null,
    "Mission 19 booking is not an isolated accepted unpaid booking."
  );

  const gross = Number(booking.amount_total);
  invariant(Number.isSafeInteger(gross) && gross > 1, "Mission 19 amount invalid.");

  const nonce = randomUUID().replaceAll("-", "");
  let stripeAccountId = `acct_M19${nonce.slice(0, 20)}`;

  const { data: canonicalIdentity, error: canonicalIdentityError } = await admin
    .from("account_stripe_connect_identities")
    .select("stripe_account_id, identity_state")
    .eq("account_id", accountId)
    .maybeSingle();
  if (canonicalIdentityError) throw new Error(canonicalIdentityError.message);

  if (canonicalIdentity) {
    invariant(
      canonicalIdentity.identity_state === "linked" &&
        typeof canonicalIdentity.stripe_account_id === "string",
      "Mission 19 canonical Stripe identity is not linked."
    );
    stripeAccountId = canonicalIdentity.stripe_account_id;
  } else {
    const { error } = await admin
      .from("account_stripe_connect_identities")
      .insert({
        account_id: accountId,
        stripe_account_id: stripeAccountId,
        identity_state: "linked",
        source_profile_ids: [provider.id],
        conflicting_stripe_account_ids: [],
      });
    if (error) throw new Error(error.message);
  }

  const fee = Math.max(1, Math.floor(gross / 10));
  const checkoutSessionId = `cs_test_m19_${nonce}`;
  const paymentIntentId = `pi_m19_${nonce}`;
  const chargeId = `ch_m19_${nonce}`;

  const { error: settlementError } = await admin
    .from("booking_settlements")
    .insert({
      booking_id: bookingId,
      provider_profile_id: provider.id,
      stripe_account_id: stripeAccountId,
      payment_mode: "platform_held",
      currency: String(booking.currency ?? "EUR").toUpperCase(),
      gross_amount_cents: gross,
      platform_fee_cents: fee,
      provider_amount_cents: gross - fee,
      stripe_checkout_session_id: checkoutSessionId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      transfer_group: `m19_${nonce}`,
      state: "held",
    });
  if (settlementError) throw new Error(settlementError.message);

  const now = new Date().toISOString();
  const { error: paidError } = await admin
    .from("bookings")
    .update({
      payment_mode: "platform_held",
      payment_status: "paid",
      stripe_checkout_session_id: checkoutSessionId,
      stripe_payment_intent_id: paymentIntentId,
      paid_at: now,
      status: "completed",
      service_status: "completed",
      provider_finished_at: now,
      client_confirmed_at: now,
      completed_at: now,
      refund_status: "not_required",
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("payment_status", "unpaid");
  if (paidError) throw new Error(paidError.message);
