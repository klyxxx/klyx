import { createHash, createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";
const FLOW = "platform_held_group_multiexecutor";
const PAYMENT_MODE = "platform_held_group";
const PROOF_PATH =
  "stripe-network-proof/platform-held-group-multiexecutor-proof.json";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function daysAgoDate(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

function stripeObjectId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

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
  const requestHeaders = { "Content-Type": "application/json", ...headers };
  if (accessToken) requestHeaders.Authorization = "Bearer " + accessToken;
  if (profileId) {
    requestHeaders.Cookie =
      ACTIVE_PROFILE_COOKIE + "=" + encodeURIComponent(profileId);
  }

  const response = await fetch(appOrigin + path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      method +
        " " +
        path +
        " returned " +
        response.status +
        ": " +
        String(payload?.error ?? "unexpected response")
    );
  }

  return { status: response.status, payload };
}

function signedStripeEvent(event, webhookSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify(event);
  const signature = createHmac("sha256", webhookSecret)
    .update(String(timestamp) + "." + raw, "utf8")
    .digest("hex");
  return { raw, signature: "t=" + timestamp + ",v1=" + signature };
}

async function postWebhook({ appOrigin, webhookSecret, event }) {
  const signed = signedStripeEvent(event, webhookSecret);
  return requestJson({
    appOrigin,
    path: "/api/stripe/webhook",
    method: "POST",
    body: undefined,
    headers: {
      "stripe-signature": signed.signature,
      "Content-Type": "application/json",
    },
    expectedStatuses: [200],
    rawBody: signed.raw,
  });
}

async function postWebhookRaw({ appOrigin, webhookSecret, event }) {
  const signed = signedStripeEvent(event, webhookSecret);
  const response = await fetch(appOrigin + "/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signed.signature,
    },
    body: signed.raw,
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;
  if (response.status !== 200) {
    throw new Error(
      "Stripe webhook returned " +
        response.status +
        ": " +
        String(payload?.error ?? "unexpected response")
    );
  }
  return payload;
}

async function insertOne(admin, table, payload, select = "*") {
  const { data, error } = await admin.from(table).insert(payload).select(select).single();
  if (error) throw new Error(table + " insert failed: " + error.message);
  return data;
}

async function createProvider({
  admin,
  supabaseUrl,
  publishableKey,
  serviceId,
  label,
}) {
  const email =
    "group-held-" + label + "-" + randomUUID().replaceAll("-", "") + "@example.test";
  const password = "Klyx-" + randomUUID() + "-Test9!";

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "KLYX Group " + label, account_type: "provider" },
  });
  if (createError || !created.user) {
    throw new Error(
      "Unable to create " + label + " provider auth user: " +
        String(createError?.message ?? "missing user")
    );
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signed, error: signError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signError || !signed.session) {
    throw new Error("Unable to sign in " + label + " provider.");
  }

  const { data: profileId, error: profileError } = await client.rpc(
    "klyx_create_profile",
    {
      p_first_name: "Group",
      p_last_name: label,
      p_city: "Bruxelles",
      p_account_type: "provider",
      p_service_id: serviceId,
    }
  );
  if (profileError || typeof profileId !== "string") {
    throw new Error(
      "Unable to create " + label + " provider profile: " +
        String(profileError?.message ?? "invalid id")
    );
  }

  const { data: profile, error: normalizeError } = await admin
    .from("profiles")
    .update({
      country_code: "BE",
      currency_code: "EUR",
      city: "Bruxelles",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("id, account_id, owner_user_id")
    .single();

  if (normalizeError || !profile?.account_id) {
    throw new Error(
      "Unable to normalize " + label + " provider: " +
        String(normalizeError?.message ?? "missing account")
    );
  }

  const { error: capabilityError } = await admin
    .from("account_actor_capabilities")
    .upsert(
      {
        account_id: profile.account_id,
        capability: "offer_services",
        enabled: true,
        source: "system",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,capability" }
    );
  if (capabilityError) throw new Error(capabilityError.message);

  const { data: userService, error: serviceError } = await admin
    .from("user_services")
    .select("id")
    .eq("user_id", profile.id)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (serviceError || !userService?.id) {
    throw new Error(
      "Unable to load " + label + " provider service: " +
        String(serviceError?.message ?? "missing user_service")
    );
  }

  const { error: userServiceUpdateError } = await admin
    .from("user_services")
    .update({ active: true, provider_enabled: true })
    .eq("id", userService.id);
  if (userServiceUpdateError) throw new Error(userServiceUpdateError.message);

  const { error: availabilityDeleteError } = await admin
    .from("availability_slots")
    .delete()
    .eq("user_service_id", userService.id);
  if (availabilityDeleteError) throw new Error(availabilityDeleteError.message);

  const { error: availabilityInsertError } = await admin
    .from("availability_slots")
    .insert(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        user_service_id: userService.id,
        day_of_week: dayOfWeek,
        start_time: "08:00",
        end_time: "20:00",
        is_active: true,
        updated_at: new Date().toISOString(),
      }))
    );
  if (availabilityInsertError) throw new Error(availabilityInsertError.message);

  await client.auth.signOut();

  return {
    id: profile.id,
    accountId: profile.account_id,
    userId: created.user.id,
    email,
    userServiceId: userService.id,
  };
}

function recipientReady(account) {
  return Boolean(
    account?.livemode === false &&
      account?.identity?.country === "BE" &&
      account?.applied_configurations?.includes("recipient") === true &&
      account?.configuration?.recipient?.applied === true &&
      account?.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === "active"
  );
}

async function createRecipient(stripe, provider, label) {
  const created = await stripe.v2.core.accounts.create(
    {
      contact_email:
        "stripe-group-" + label + "-" + randomUUID().replaceAll("-", "") + "@example.com",
      display_name: "KLYX Group " + label,
      dashboard: "none",
      identity: {
        country: "BE",
        entity_type: "individual",
        attestations: {
          terms_of_service: {
            account: {
              date: new Date().toISOString(),
              ip: "127.0.0.1",
              user_agent: "KLYX Stripe TEST group certification",
            },
          },
        },
        individual: {
          given_name: "Klyx",
          surname: "Group" + label,
          email:
            "stripe-id-" + label + "-" + randomUUID().replaceAll("-", "") + "@example.com",
          phone: label === "A" ? "+32470123451" : "+32470123452",
          date_of_birth: { day: label === "A" ? 2 : 3, month: 1, year: 1902 },
          address: {
            line1: "address_full_match",
            city: "Bruxelles",
            postal_code: "1000",
            country: "BE",
          },
        },
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      defaults: {
        currency: "eur",
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      metadata: {
        klyx_platform_held_group_network_fixture: "true",
        klyx_provider_profile_id: provider.id,
      },
      include: ["configuration.recipient", "identity", "requirements"],
    },
    {
      idempotencyKey:
        "klyx-platform-held-group-network-" + provider.id,
    }
  );

  await stripe.accounts.update(created.id, {
    business_profile: { url: "https://accessible.stripe.com" },
  });

  let account = await stripe.v2.core.accounts.retrieve(created.id, {
    include: ["configuration.recipient", "identity", "requirements"],
  });

  for (let attempt = 0; attempt < 20 && !recipientReady(account); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    account = await stripe.v2.core.accounts.retrieve(created.id, {
      include: ["configuration.recipient", "identity", "requirements"],
    });
  }

  assert(recipientReady(account), label + " Stripe recipient is not transfer-ready.");
  return account;
}

async function bindRecipient(admin, provider, stripeAccountId) {
  const { error: identityError } = await admin
    .from("account_stripe_connect_identities")
    .upsert(
      {
        account_id: provider.accountId,
        stripe_account_id: stripeAccountId,
        identity_state: "linked",
        source_profile_ids: [provider.id],
        conflicting_stripe_account_ids: [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );
  if (identityError) throw new Error(identityError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      stripe_account_id: stripeAccountId,
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", provider.id)
    .eq("account_id", provider.accountId);
  if (profileError) throw new Error(profileError.message);
}

async function closeRecipient(stripe, accountId) {
  try {
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient", "identity", "requirements"],
    });
    if (account?.closed === true) return;
    const configurations = account.applied_configurations ?? [];
    if (configurations.length === 0) return;
    const closed = await stripe.v2.core.accounts.close(accountId, {
      applied_configurations: configurations,
    });
    assert(closed.closed === true, "Stripe TEST recipient did not close.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/closed|not found|resource_missing/i.test(message)) throw error;
  }
}

async function setupBatch({
  admin,
  clientId,
  serviceId,
  providerA,
  providerB,
  stripeA,
  stripeB,
}) {
  const now = new Date().toISOString();
  const requestDate = daysAgoDate(1);

  const request = await insertOne(
    admin,
    "market_service_requests",
    {
      client_profile_id: clientId,
      service_id: serviceId,
      title: "Stripe TEST Platform-Held multi-executor proof",
      description: "Ephemeral Group Booking settlement proof.",
      city: "Bruxelles",
      requested_date: requestDate,
      requested_time: "09:00",
      budget_max: 101,
      budget_total: 101,
      status: "open",
      request_mode: "multi_slot",
      slot_count: 3,
      prefer_single_provider: false,
      country_code: "BE",
      currency: "EUR",
    },
    "id"
  );

  const planConfirmation = await insertOne(
    admin,
    "market_split_plan_confirmations",
    {
      market_request_id: request.id,
      client_profile_id: clientId,
      plan_hash: hash("group-plan-" + request.id),
      plan_snapshot: { proof: true, slots: 3, providers: 2 },
      slot_count: 3,
      provider_count: 2,
    },
    "id, plan_hash"
  );

  const batch = await insertOne(
    admin,
    "split_booking_batches",
    {
      market_request_id: request.id,
      client_profile_id: clientId,
      confirmation_id: planConfirmation.id,
      plan_hash: planConfirmation.plan_hash,
      status: "creating",
      expected_booking_count: 3,
      provider_count: 2,
    },
    "id"
  );

  const specs = [
    {
      provider: providerA,
      amount: 3333,
      date: daysAgoDate(1),
      start: "09:00",
      end: "10:00",
      position: 1,
    },
    {
      provider: providerA,
      amount: 3334,
      date: daysAgoDate(2),
      start: "11:00",
      end: "12:00",
      position: 2,
    },
    {
      provider: providerB,
      amount: 3334,
      date: daysAgoDate(3),
      start: "13:00",
      end: "14:00",
      position: 3,
    },
  ];

  const bookings = [];
  for (const spec of specs) {
    const booking = await insertOne(
      admin,
      "bookings",
      {
        babysitter_id: spec.provider.id,
        provider_id: spec.provider.id,
        parent_id: clientId,
        booking_date: spec.date,
        start_time: spec.start,
        end_time: spec.end,
        status: "accepted",
        payment_status: "unpaid",
        service_status: "scheduled",
        amount_total: spec.amount,
        estimated_amount_cents: spec.amount,
        currency: "EUR",
        service_id: serviceId,
        user_service_id: spec.provider.userServiceId,
        pricing_type_snapshot: "fixed",
        unit_price_cents: spec.amount,
        country_code: "BE",
        accepted_at: now,
        updated_at: now,
      },
      "id"
    );
    bookings.push({ ...booking, ...spec });
  }

  const { error: itemError } = await admin.from("split_booking_batch_items").insert(
    bookings.map((booking) => ({
      batch_id: batch.id,
      booking_id: booking.id,
      slot_id: "group-held-" + batch.id + "-" + booking.position,
      slot_position: booking.position,
      provider_profile_id: booking.provider.id,
      user_service_id: booking.provider.userServiceId,
    }))
  );
  if (itemError) throw new Error(itemError.message);

  const { error: readyError } = await admin
    .from("split_booking_batches")
    .update({ status: "created", completed_at: now, updated_at: now })
    .eq("id", batch.id);
  if (readyError) throw new Error(readyError.message);

  const priceConfirmation = await insertOne(
    admin,
    "split_booking_price_confirmations",
    {
      batch_id: batch.id,
      client_profile_id: clientId,
      price_hash: hash("group-price-" + batch.id),
      price_snapshot: { proof: true, total_amount_cents: 10001 },
      item_count: 3,
      total_amount_cents: 10001,
      currency: "EUR",
    },
    "id"
  );

  const units = [
    {
      providerId: providerA.id,
      amountCents: 6667,
      currency: "EUR",
      bookingIds: bookings
        .filter((booking) => booking.provider.id === providerA.id)
        .map((booking) => booking.id)
        .sort(),
      slotIds: bookings
        .filter((booking) => booking.provider.id === providerA.id)
        .map((booking) => "group-held-" + batch.id + "-" + booking.position)
        .sort(),
      stripeAccountId: stripeA.id,
    },
    {
      providerId: providerB.id,
      amountCents: 3334,
      currency: "EUR",
      bookingIds: bookings
        .filter((booking) => booking.provider.id === providerB.id)
        .map((booking) => booking.id)
        .sort(),
      slotIds: bookings
        .filter((booking) => booking.provider.id === providerB.id)
        .map((booking) => "group-held-" + batch.id + "-" + booking.position)
        .sort(),
      stripeAccountId: stripeB.id,
    },
  ].sort((a, b) => a.providerId.localeCompare(b.providerId));

  const canonicalPlan = {
    batchId: batch.id,
    priceConfirmationId: priceConfirmation.id,
    providerCount: 2,
    paymentUnitCount: 2,
    totalAmountCents: 10001,
    currency: "EUR",
    units,
  };

  const paymentConfirmation = await insertOne(
    admin,
    "split_booking_payment_confirmations",
    {
      batch_id: batch.id,
      client_profile_id: clientId,
      price_confirmation_id: priceConfirmation.id,
      payment_plan_hash: hash(JSON.stringify(canonicalPlan)),
      payment_plan_snapshot: canonicalPlan,
      provider_count: 2,
      payment_unit_count: 2,
      total_amount_cents: 10001,
      currency: "EUR",
    },
    "id"
  );

  return { batch, bookings, paymentConfirmation, canonicalPlan };
}

async function loadParent(admin, batchId) {
  const { data, error } = await admin
    .from("platform_held_group_settlements")
    .select("*")
    .eq("batch_id", batchId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadMembers(admin, parentId) {
  const { data, error } = await admin
    .from("platform_held_group_settlement_members")
    .select("*")
    .eq("group_settlement_id", parentId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function completeBooking({
  admin,
  appOrigin,
  accessToken,
  clientId,
  bookingId,
}) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("bookings")
    .update({
      service_status: "in_progress",
      provider_finished_at: now,
      updated_at: now,
    })
    .eq("id", bookingId);
  if (error) throw new Error(error.message);

  return requestJson({
    appOrigin,
    accessToken,
    profileId: clientId,
    path: "/api/bookings/tracking",
    method: "POST",
    body: { bookingId, action: "client_confirmed", note: "Stripe TEST proof." },
  });
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  assert(localSupabase, "Group settlement network proof requires local Supabase.");

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  assert(
    appOrigin === "http://127.0.0.1:3100",
    "Group settlement network proof requires isolated KLYX on port 3100."
  );

  const stripeKey = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const publishable = requiredGoldenPathEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");

  assert(stripeKey.startsWith("sk_test_"), "Stripe TEST secret key required.");
  assert(
    process.env.KLYX_STRIPE_MODE === "test" &&
      process.env.KLYX_STRIPE_SETTLEMENT_MODE === "platform_held" &&
      process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY === "true" &&
      process.env.KLYX_LIVE_PAYMENTS_ENABLED === "false",
    "Unsafe group settlement network runtime."
  );

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userClient = createClient(e2eOrigin, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const stripe = new Stripe(stripeKey);

  const { data: signIn, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn.session || !signIn.user) {
    throw new Error("Unable to authenticate group settlement proof client.");
  }

  const accessToken = signIn.session.access_token;
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signIn.user.id);
  if (profileError) throw new Error(profileError.message);

  const client = (profiles ?? []).find((profile) => profile.account_type === "client");
  assert(client, "Golden client profile missing.");

  const { data: service, error: serviceError } = await admin
    .from("services")
    .select("id")
    .limit(1)
    .single();
  if (serviceError || !service) throw new Error("Service catalog missing.");

  let stripeA = null;
  let stripeB = null;
  let stripeBClosed = false;
  let checkoutSessionId = null;
  let concurrencyCheckoutSessionId = null;
  let preReleaseRefundCheckoutSessionId = null;
  let concurrencyProof = null;
  let preReleaseRefundProof = null;

  try {
    const providerA = await createProvider({
      admin,
      supabaseUrl: e2eOrigin,
      publishableKey: publishable,
      serviceId: service.id,
      label: "A",
    });
    const providerB = await createProvider({
      admin,
      supabaseUrl: e2eOrigin,
      publishableKey: publishable,
      serviceId: service.id,
      label: "B",
    });

    stripeA = await createRecipient(stripe, providerA, "A");
    stripeB = await createRecipient(stripe, providerB, "B");
    assert(stripeA.id !== stripeB.id, "Proof recipients must be distinct.");

    await bindRecipient(admin, providerA, stripeA.id);
    await bindRecipient(admin, providerB, stripeB.id);

    const fixture = await setupBatch({
      admin,
      clientId: client.id,
      serviceId: service.id,
      providerA,
      providerB,
      stripeA,
      stripeB,
    });

    const checkout = await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/split-missions/" + fixture.batch.id + "/checkout",
      method: "POST",
      body: { checkoutPreparationConfirmed: true },
    });

    assert(checkout.payload?.paymentMode === PAYMENT_MODE, "Wrong payment mode.");
    assert(checkout.payload?.executorCount === 2, "Expected two executors.");
    assert(checkout.payload?.amountTotalCents === 10001, "Gross amount mismatch.");
    checkoutSessionId = new URL(checkout.payload.url).pathname.split("/").filter(Boolean).pop();

    let parent = await loadParent(admin, fixture.batch.id);
    assert(parent.state === "pending_payment", "Parent must begin pending_payment.");
    assert(
      parent.stripe_checkout_session_id?.startsWith("cs_"),
      "Real Checkout session was not attached."
    );
    checkoutSessionId = parent.stripe_checkout_session_id;

    let members = await loadMembers(admin, parent.id);
    assert(members.length === 2, "Expected exactly two frozen executor settlements.");
    assert(
      members.reduce((sum, row) => sum + Number(row.gross_amount_cents), 0) === 10001,
      "Member gross totals do not reconcile."
    );
    assert(
      members.reduce((sum, row) => sum + Number(row.platform_fee_cents), 0) ===
        Number(parent.platform_fee_cents),
      "Member commission totals do not reconcile."
    );
    assert(
      members.reduce((sum, row) => sum + Number(row.provider_amount_cents), 0) ===
        Number(parent.provider_amount_cents),
      "Member provider totals do not reconcile."
    );
    assert(Number(parent.platform_fee_cents) > 0, "Platform commission must be positive.");

    const metadata = {
      klyx_flow: FLOW,
      split_batch_id: fixture.batch.id,
      group_settlement_id: parent.id,
      payment_confirmation_id: fixture.paymentConfirmation.id,
      payment_mode: PAYMENT_MODE,
      settlement_transfer_group: parent.transfer_group,
      executor_count: "2",
    };

    const intent = await stripe.paymentIntents.create(
      {
        amount: 10001,
        currency: "eur",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        transfer_group: parent.transfer_group,
        metadata,
      },
      { idempotencyKey: "klyx-group-proof-charge-" + parent.id }
    );
    const paidIntent = await stripe.paymentIntents.retrieve(intent.id, {
      expand: ["latest_charge"],
    });
    const chargeId = stripeObjectId(paidIntent.latest_charge);
    assert(paidIntent.status === "succeeded", "Platform charge did not succeed.");
    assert(chargeId?.startsWith("ch_"), "Platform charge id missing.");

    const paymentEvent = {
      id: "evt_test_group_paid_" + randomUUID().replaceAll("-", ""),
      object: "event",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: parent.stripe_checkout_session_id,
          object: "checkout.session",
          amount_total: 10001,
          currency: "eur",
          metadata,
          mode: "payment",
          payment_intent: paidIntent.id,
          payment_status: "paid",
          status: "complete",
          livemode: false,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
    };

    const webhook = await postWebhookRaw({ appOrigin, webhookSecret, event: paymentEvent });
    assert(webhook?.platformHeldGroup === true, "Held group webhook not recognized.");

    parent = await loadParent(admin, fixture.batch.id);
    members = await loadMembers(admin, parent.id);
    assert(parent.state === "held", "Parent settlement did not enter held state.");
    assert(parent.stripe_payment_intent_id === paidIntent.id, "PaymentIntent truth mismatch.");
    assert(parent.stripe_charge_id === chargeId, "Charge truth mismatch.");

    const providerABookings = fixture.bookings.filter(
      (booking) => booking.provider.id === providerA.id
    );
    const providerBBooking = fixture.bookings.find(
      (booking) => booking.provider.id === providerB.id
    );
    assert(providerABookings.length === 2 && providerBBooking, "Fixture booking split invalid.");

    await completeBooking({
      admin,
      appOrigin,
      accessToken,
      clientId: client.id,
      bookingId: providerABookings[0].id,
    });

    let remoteTransfers = await stripe.transfers.list({
      transfer_group: parent.transfer_group,
      limit: 100,
    });
    assert(remoteTransfers.data.length === 0, "Executor A released before all its bookings completed.");

    await completeBooking({
      admin,
      appOrigin,
      accessToken,
      clientId: client.id,
      bookingId: providerABookings[1].id,
    });

    members = await loadMembers(admin, parent.id);
    const memberA = members.find((member) => member.provider_profile_id === providerA.id);
    let memberB = members.find((member) => member.provider_profile_id === providerB.id);
    assert(memberA && memberB, "Frozen executor rows missing.");

    remoteTransfers = await stripe.transfers.list({
      transfer_group: parent.transfer_group,
      limit: 100,
    });
    let transferA = remoteTransfers.data.find(
      (transfer) => transfer.metadata?.group_settlement_member_id === memberA.id
    );

    if (!transferA) {
      const { data: memberDiagnostic, error: memberDiagnosticError } = await admin
        .from("platform_held_group_settlement_members")
        .select(
          "id, state, release_attempt_number, release_claim_token, release_claimed_at, stripe_transfer_id, last_error_code, last_error_message, provider_account_id, provider_profile_id"
        )
        .eq("id", memberA.id)
        .single();
      if (memberDiagnosticError) throw new Error(memberDiagnosticError.message);

      const { data: bookingDiagnostics, error: bookingDiagnosticsError } = await admin
        .from("bookings")
        .select("id, status, service_status, payment_status, payment_mode, completed_at, client_confirmed_at")
        .in("id", providerABookings.map((booking) => booking.id));
      if (bookingDiagnosticsError) throw new Error(bookingDiagnosticsError.message);

      const { data: riskDiagnostics, error: riskDiagnosticsError } = await admin
        .from("transaction_risk_decisions")
        .select(
          "account_id, action, participant, subject_type, subject_id, decision, reason_codes, risk_assessed_at"
        )
        .eq("account_id", memberA.provider_account_id)
        .eq("action", "settlement_release")
        .eq("participant", "settlement_recipient")
        .eq("subject_type", "split_batch")
        .eq("subject_id", fixture.batch.id)
        .order("risk_assessed_at", { ascending: false })
        .limit(3);
      if (riskDiagnosticsError) throw new Error(riskDiagnosticsError.message);

      throw new Error(
        "Executor A Transfer missing. diagnostics=" +
          JSON.stringify({
            parent: {
              id: parent.id,
              state: parent.state,
              stripeChargeId: parent.stripe_charge_id,
              providerAmountCents: parent.provider_amount_cents,
            },
            member: memberDiagnostic,
            bookings: bookingDiagnostics,
            risk: riskDiagnostics,
            remoteTransfers: remoteTransfers.data.map((transfer) => ({
              id: transfer.id,
              amount: transfer.amount,
              destination: stripeObjectId(transfer.destination),
              memberId: transfer.metadata?.group_settlement_member_id ?? null,
            })),
          })
      );
    }
    assert(
      transferA.amount === Number(memberA.provider_amount_cents),
      "Executor A Transfer amount mismatch."
    );
    assert(stripeObjectId(transferA.source_transaction) === chargeId, "Transfer source charge mismatch.");

    const resetNow = new Date().toISOString();
    const { error: resetError } = await admin
      .from("bookings")
      .update({
        status: "accepted",
        service_status: "in_progress",
        client_confirmed_at: null,
        completed_at: null,
        provider_finished_at: resetNow,
        updated_at: resetNow,
      })
      .eq("id", providerABookings[1].id);
    if (resetError) throw new Error(resetError.message);

    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/tracking",
      method: "POST",
      body: {
        bookingId: providerABookings[1].id,
        action: "client_confirmed",
        note: "Idempotent release replay.",
      },
    });

    remoteTransfers = await stripe.transfers.list({
      transfer_group: parent.transfer_group,
      limit: 100,
    });
    const aTransfers = remoteTransfers.data.filter(
      (transfer) => transfer.metadata?.group_settlement_member_id === memberA.id
    );
    assert(aTransfers.length === 1, "Executor A release was duplicated.");
    transferA = aTransfers[0];

    // Independent concurrency fixture: both executor releases become eligible
    // at the same time. The parent-row lock + remote Stripe reconciliation must
    // allow both exact transfers without ever exceeding frozen provider funds.
    const concurrencyFixture = await setupBatch({
      admin,
      clientId: client.id,
      serviceId: service.id,
      providerA,
      providerB,
      stripeA,
      stripeB,
    });

    const concurrencyCheckout = await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path:
        "/api/bookings/split-missions/" +
        concurrencyFixture.batch.id +
        "/checkout",
      method: "POST",
      body: { checkoutPreparationConfirmed: true },
    });
    assert(
      concurrencyCheckout.payload?.paymentMode === PAYMENT_MODE,
      "Concurrency fixture did not use Platform-Held group mode."
    );

    let concurrencyParent = await loadParent(
      admin,
      concurrencyFixture.batch.id
    );
    concurrencyCheckoutSessionId =
      concurrencyParent.stripe_checkout_session_id;
    assert(
      concurrencyCheckoutSessionId?.startsWith("cs_"),
      "Concurrency fixture Checkout session missing."
    );

    const concurrencyMetadata = {
      klyx_flow: FLOW,
      split_batch_id: concurrencyFixture.batch.id,
      group_settlement_id: concurrencyParent.id,
      payment_confirmation_id: concurrencyFixture.paymentConfirmation.id,
      payment_mode: PAYMENT_MODE,
      settlement_transfer_group: concurrencyParent.transfer_group,
      executor_count: "2",
    };

    const concurrencyIntent = await stripe.paymentIntents.create(
      {
        amount: 10001,
        currency: "eur",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        transfer_group: concurrencyParent.transfer_group,
        metadata: concurrencyMetadata,
      },
      {
        idempotencyKey:
          "klyx-group-concurrency-proof-charge-" + concurrencyParent.id,
      }
    );
    const paidConcurrencyIntent = await stripe.paymentIntents.retrieve(
      concurrencyIntent.id,
      { expand: ["latest_charge"] }
    );
    const concurrencyChargeId = stripeObjectId(
      paidConcurrencyIntent.latest_charge
    );
    assert(
      paidConcurrencyIntent.status === "succeeded" &&
        concurrencyChargeId?.startsWith("ch_"),
      "Concurrency fixture platform charge did not succeed."
    );

    const concurrencyPaymentEvent = {
      id:
        "evt_test_group_concurrent_paid_" +
        randomUUID().replaceAll("-", ""),
      object: "event",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: concurrencyParent.stripe_checkout_session_id,
          object: "checkout.session",
          amount_total: 10001,
          currency: "eur",
          metadata: concurrencyMetadata,
          mode: "payment",
          payment_intent: paidConcurrencyIntent.id,
          payment_status: "paid",
          status: "complete",
          livemode: false,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
    };

    const concurrencyWebhook = await postWebhookRaw({
      appOrigin,
      webhookSecret,
      event: concurrencyPaymentEvent,
    });
    assert(
      concurrencyWebhook?.platformHeldGroup === true,
      "Concurrency fixture webhook was not recognized."
    );

    concurrencyParent = await loadParent(
      admin,
      concurrencyFixture.batch.id
    );
    assert(
      concurrencyParent.state === "held" &&
        concurrencyParent.stripe_charge_id === concurrencyChargeId,
      "Concurrency fixture did not enter held state."
    );

    const concurrencyABookings = concurrencyFixture.bookings.filter(
      (booking) => booking.provider.id === providerA.id
    );
    const concurrencyBBooking = concurrencyFixture.bookings.find(
      (booking) => booking.provider.id === providerB.id
    );
    assert(
      concurrencyABookings.length === 2 && concurrencyBBooking,
      "Concurrency fixture booking split invalid."
    );

    await completeBooking({
      admin,
      appOrigin,
      accessToken,
      clientId: client.id,
      bookingId: concurrencyABookings[0].id,
    });

    let concurrencyTransfers = await stripe.transfers.list({
      transfer_group: concurrencyParent.transfer_group,
      limit: 100,
    });
    assert(
      concurrencyTransfers.data.length === 0,
      "Concurrency fixture released executor A too early."
    );

    await Promise.all([
      completeBooking({
        admin,
        appOrigin,
        accessToken,
        clientId: client.id,
        bookingId: concurrencyABookings[1].id,
      }),
      completeBooking({
        admin,
        appOrigin,
        accessToken,
        clientId: client.id,
        bookingId: concurrencyBBooking.id,
      }),
    ]);

    const concurrencyMembers = await loadMembers(
      admin,
      concurrencyParent.id
    );
    concurrencyTransfers = await stripe.transfers.list({
      transfer_group: concurrencyParent.transfer_group,
      limit: 100,
    });

    const concurrencyTransferred = concurrencyTransfers.data.reduce(
      (sum, transfer) => sum + transfer.amount,
      0
    );
    const concurrencyMemberIds = new Set(
      concurrencyTransfers.data.map(
        (transfer) => transfer.metadata?.group_settlement_member_id
      )
    );

    assert(
      concurrencyTransfers.data.length === 2 &&
        concurrencyMemberIds.size === 2,
      "Concurrent releases did not create exactly one Transfer per executor."
    );
    assert(
      concurrencyTransferred ===
        Number(concurrencyParent.provider_amount_cents),
      "Concurrent releases do not exactly equal frozen provider funds."
    );
    assert(
      concurrencyTransferred <=
        Number(concurrencyParent.provider_amount_cents),
      "Concurrent releases exceeded frozen provider funds."
    );
    assert(
      concurrencyTransfers.data.every(
        (transfer) =>
          stripeObjectId(transfer.source_transaction) ===
            concurrencyChargeId &&
          transfer.transfer_group === concurrencyParent.transfer_group
      ),
      "Concurrent executor Transfers were not financed by the one frozen charge."
    );
    assert(
      concurrencyMembers.every((member) => member.state === "released"),
      "Concurrent executor member states did not finalize independently."
    );

    concurrencyProof = {
      batchId: concurrencyFixture.batch.id,
      groupSettlementId: concurrencyParent.id,
      chargeId: concurrencyChargeId,
      transferGroup: concurrencyParent.transfer_group,
      concurrentReleaseCount: concurrencyTransfers.data.length,
      transferredAmountCents: concurrencyTransferred,
      providerAmountCapCents: Number(
        concurrencyParent.provider_amount_cents
      ),
      distinctMemberTransfers: concurrencyMemberIds.size,
    };

    // Refund-before-release proof: executor B is partially refunded while no
    // provider Transfer exists. Once B completes, the later Transfer must equal
    // only the remaining provider entitlement, never the frozen original.
    const preReleaseRefundFixture = await setupBatch({
      admin,
      clientId: client.id,
      serviceId: service.id,
      providerA,
      providerB,
      stripeA,
      stripeB,
    });

    const preReleaseCheckout = await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path:
        "/api/bookings/split-missions/" +
        preReleaseRefundFixture.batch.id +
        "/checkout",
      method: "POST",
      body: { checkoutPreparationConfirmed: true },
    });
    assert(
      preReleaseCheckout.payload?.paymentMode === PAYMENT_MODE,
      "Pre-release refund fixture did not use Platform-Held group mode."
    );

    let preReleaseParent = await loadParent(
      admin,
      preReleaseRefundFixture.batch.id
    );
    preReleaseRefundCheckoutSessionId =
      preReleaseParent.stripe_checkout_session_id;
    assert(
      preReleaseRefundCheckoutSessionId?.startsWith("cs_"),
      "Pre-release refund Checkout session missing."
    );

    const preReleaseMetadata = {
      klyx_flow: FLOW,
      split_batch_id: preReleaseRefundFixture.batch.id,
      group_settlement_id: preReleaseParent.id,
      payment_confirmation_id:
        preReleaseRefundFixture.paymentConfirmation.id,
      payment_mode: PAYMENT_MODE,
      settlement_transfer_group: preReleaseParent.transfer_group,
      executor_count: "2",
    };

    const preReleaseIntent = await stripe.paymentIntents.create(
      {
        amount: 10001,
        currency: "eur",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        transfer_group: preReleaseParent.transfer_group,
        metadata: preReleaseMetadata,
      },
      {
        idempotencyKey:
          "klyx-group-pre-release-refund-proof-charge-" +
          preReleaseParent.id,
      }
    );
    const paidPreReleaseIntent = await stripe.paymentIntents.retrieve(
      preReleaseIntent.id,
      { expand: ["latest_charge"] }
    );
    const preReleaseChargeId = stripeObjectId(
      paidPreReleaseIntent.latest_charge
    );
    assert(
      paidPreReleaseIntent.status === "succeeded" &&
        preReleaseChargeId?.startsWith("ch_"),
      "Pre-release refund platform charge did not succeed."
    );

    const preReleasePaymentEvent = {
      id:
        "evt_test_group_pre_release_refund_paid_" +
        randomUUID().replaceAll("-", ""),
      object: "event",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: preReleaseParent.stripe_checkout_session_id,
          object: "checkout.session",
          amount_total: 10001,
          currency: "eur",
          metadata: preReleaseMetadata,
          mode: "payment",
          payment_intent: paidPreReleaseIntent.id,
          payment_status: "paid",
          status: "complete",
          livemode: false,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
    };

    const preReleaseWebhook = await postWebhookRaw({
      appOrigin,
      webhookSecret,
      event: preReleasePaymentEvent,
    });
    assert(
      preReleaseWebhook?.platformHeldGroup === true,
      "Pre-release refund fixture webhook was not recognized."
    );

    preReleaseParent = await loadParent(
      admin,
      preReleaseRefundFixture.batch.id
    );
    let preReleaseMembers = await loadMembers(
      admin,
      preReleaseParent.id
    );
    let preReleaseMemberB = preReleaseMembers.find(
      (member) => member.provider_profile_id === providerB.id
    );
    const preReleaseBBooking = preReleaseRefundFixture.bookings.find(
      (booking) => booking.provider.id === providerB.id
    );
    assert(
      preReleaseMemberB && preReleaseBBooking,
      "Pre-release refund executor B fixture is incomplete."
    );

    let preReleaseTransfers = await stripe.transfers.list({
      transfer_group: preReleaseParent.transfer_group,
      limit: 100,
    });
    assert(
      preReleaseTransfers.data.length === 0,
      "Pre-release refund fixture unexpectedly transferred provider funds before completion."
    );

    const preReleasePartialGross = 500;
    const preReleaseRequestKey =
      "network-pre-release-partial-" + randomUUID();
    const preReleaseRefundBody = {
      kind: "partial",
      requestKey: preReleaseRequestKey,
      amountCents: preReleasePartialGross,
      allocations: [
        {
          memberId: preReleaseMemberB.id,
          grossRefundCents: preReleasePartialGross,
        },
      ],
    };

    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path:
        "/api/bookings/split-missions/" +
        preReleaseRefundFixture.batch.id +
        "/refund",
      method: "POST",
      body: preReleaseRefundBody,
    });

    let { data: preReleaseRefundRow, error: preReleaseRefundError } =
      await admin
        .from("platform_held_group_refunds")
        .select("*")
        .eq("group_settlement_id", preReleaseParent.id)
        .eq("request_key", preReleaseRequestKey)
        .single();
    if (preReleaseRefundError) {
      throw new Error(preReleaseRefundError.message);
    }
    assert(
      preReleaseRefundRow.stripe_refund_id?.startsWith("re_"),
      "Pre-release Stripe partial refund id missing."
    );

    let preReleaseRemoteRefund = await stripe.refunds.retrieve(
      preReleaseRefundRow.stripe_refund_id
    );
    for (
      let attempt = 0;
      attempt < 20 && preReleaseRemoteRefund.status === "pending";
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      preReleaseRemoteRefund = await stripe.refunds.retrieve(
        preReleaseRefundRow.stripe_refund_id
      );
    }
    assert(
      preReleaseRemoteRefund.status === "succeeded",
      "Pre-release Stripe partial refund did not succeed."
    );

    if (preReleaseRefundRow.state !== "succeeded") {
      const preReleaseRefundEvent = {
        id:
          "evt_test_group_pre_release_refund_" +
          randomUUID().replaceAll("-", ""),
        object: "event",
        created: Math.floor(Date.now() / 1000),
        data: { object: preReleaseRemoteRefund },
        livemode: false,
        pending_webhooks: 1,
        request: { id: null, idempotency_key: null },
        type: "refund.updated",
      };
      await postWebhookRaw({
        appOrigin,
        webhookSecret,
        event: preReleaseRefundEvent,
      });
    }

    // Idempotent replay also forces local reconciliation when the webhook raced.
    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path:
        "/api/bookings/split-missions/" +
        preReleaseRefundFixture.batch.id +
        "/refund",
      method: "POST",
      body: preReleaseRefundBody,
    });

    ({ data: preReleaseRefundRow, error: preReleaseRefundError } =
      await admin
        .from("platform_held_group_refunds")
        .select("*")
        .eq("group_settlement_id", preReleaseParent.id)
        .eq("request_key", preReleaseRequestKey)
        .single());
    if (preReleaseRefundError) {
      throw new Error(preReleaseRefundError.message);
    }
    assert(
      preReleaseRefundRow.state === "succeeded",
      "Pre-release local refund did not finalize."
    );

    preReleaseParent = await loadParent(
      admin,
      preReleaseRefundFixture.batch.id
    );
    preReleaseMembers = await loadMembers(admin, preReleaseParent.id);
    preReleaseMemberB = preReleaseMembers.find(
      (member) => member.provider_profile_id === providerB.id
    );
    assert(
      preReleaseParent.state === "partially_refunded",
      "Pre-release partial refund did not preserve remaining release eligibility."
    );
    assert(
      Number(preReleaseMemberB.refunded_provider_amount_cents) > 0 &&
        !preReleaseMemberB.stripe_transfer_id,
      "Pre-release provider refund entitlement was not frozen before release."
    );

    const expectedPreReleaseTransfer =
      Number(preReleaseMemberB.provider_amount_cents) -
      Number(preReleaseMemberB.refunded_provider_amount_cents);
    assert(
      expectedPreReleaseTransfer > 0,
      "Pre-release refund consumed the entire provider entitlement unexpectedly."
    );

    await completeBooking({
      admin,
      appOrigin,
      accessToken,
      clientId: client.id,
      bookingId: preReleaseBBooking.id,
    });

    preReleaseTransfers = await stripe.transfers.list({
      transfer_group: preReleaseParent.transfer_group,
      limit: 100,
    });
    const preReleaseBTransfers = preReleaseTransfers.data.filter(
      (transfer) =>
        transfer.metadata?.group_settlement_member_id ===
        preReleaseMemberB.id
    );
    assert(
      preReleaseBTransfers.length === 1,
      "Pre-release refund executor B did not receive exactly one later Transfer."
    );
    assert(
      preReleaseBTransfers[0].amount === expectedPreReleaseTransfer,
      "Post-refund executor Transfer did not equal remaining provider entitlement."
    );
    assert(
      stripeObjectId(preReleaseBTransfers[0].source_transaction) ===
        preReleaseChargeId &&
        preReleaseBTransfers[0].transfer_group ===
          preReleaseParent.transfer_group,
      "Post-refund executor Transfer lost the frozen source charge/group."
    );

    preReleaseMembers = await loadMembers(admin, preReleaseParent.id);
    preReleaseMemberB = preReleaseMembers.find(
      (member) => member.provider_profile_id === providerB.id
    );
    assert(
      Number(preReleaseMemberB.released_amount_cents) ===
        expectedPreReleaseTransfer,
      "Persisted release amount does not equal the post-refund Transfer."
    );

    const preReleaseCurrentEntitlement = preReleaseMembers.reduce(
      (sum, member) =>
        sum +
        Number(member.provider_amount_cents) -
        Number(member.refunded_provider_amount_cents),
      0
    );
    const preReleaseNetTransferred = preReleaseTransfers.data.reduce(
      (sum, transfer) =>
        sum + Math.max(transfer.amount - Number(transfer.amount_reversed ?? 0), 0),
      0
    );
    assert(
      preReleaseNetTransferred <= preReleaseCurrentEntitlement,
      "Post-refund net Transfers exceeded current provider entitlement."
    );

    preReleaseRefundProof = {
      batchId: preReleaseRefundFixture.batch.id,
      groupSettlementId: preReleaseParent.id,
      chargeId: preReleaseChargeId,
      memberId: preReleaseMemberB.id,
      frozenProviderAmountCents: Number(
        preReleaseMemberB.provider_amount_cents
      ),
      refundedProviderAmountCents: Number(
        preReleaseMemberB.refunded_provider_amount_cents
      ),
      expectedTransferAmountCents: expectedPreReleaseTransfer,
      actualTransferAmountCents: preReleaseBTransfers[0].amount,
      currentProviderEntitlementCents: preReleaseCurrentEntitlement,
      netTransferredCents: preReleaseNetTransferred,
    };

    await closeRecipient(stripe, stripeB.id);
    stripeBClosed = true;

    await completeBooking({
      admin,
      appOrigin,
      accessToken,
      clientId: client.id,
      bookingId: providerBBooking.id,
    });

    members = await loadMembers(admin, parent.id);
    memberB = members.find((member) => member.provider_profile_id === providerB.id);
    const refreshedA = members.find((member) => member.provider_profile_id === providerA.id);
    assert(memberB?.state === "review_required", "Disabled executor B was not isolated to review.");
    assert(refreshedA?.state === "released", "Executor A release was lost when B became ineligible.");

    remoteTransfers = await stripe.transfers.list({
      transfer_group: parent.transfer_group,
      limit: 100,
    });
    assert(
      remoteTransfers.data.every(
        (transfer) => transfer.metadata?.group_settlement_member_id !== memberB.id
      ),
      "Disabled executor B unexpectedly received a Transfer."
    );
    assert(
      remoteTransfers.data.reduce((sum, transfer) => sum + transfer.amount, 0) <=
        Number(parent.provider_amount_cents),
      "Aggregate releases exceeded frozen provider funds."
    );

    const partialGross = Math.min(
      1000,
      Number(refreshedA.gross_amount_cents) - 1
    );

    const requestKey = "network-partial-" + randomUUID();
    const refundBody = {
      kind: "partial",
      requestKey,
      amountCents: partialGross,
      allocations: [
        {
          memberId: refreshedA.id,
          grossRefundCents: partialGross,
        },
      ],
    };

    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/split-missions/" + fixture.batch.id + "/refund",
      method: "POST",
      body: refundBody,
    });

    let { data: refundRow, error: refundRowError } = await admin
      .from("platform_held_group_refunds")
      .select("*")
      .eq("group_settlement_id", parent.id)
      .eq("request_key", requestKey)
      .single();
    if (refundRowError) throw new Error(refundRowError.message);
    assert(refundRow.stripe_refund_id?.startsWith("re_"), "Stripe partial refund id missing.");

    let remoteRefund = await stripe.refunds.retrieve(refundRow.stripe_refund_id);
    for (let attempt = 0; attempt < 20 && remoteRefund.status === "pending"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      remoteRefund = await stripe.refunds.retrieve(refundRow.stripe_refund_id);
    }
    assert(remoteRefund.status === "succeeded", "Stripe partial refund did not succeed.");

    if (refundRow.state !== "succeeded") {
      const refundEvent = {
        id: "evt_test_group_refund_" + randomUUID().replaceAll("-", ""),
        object: "event",
        created: Math.floor(Date.now() / 1000),
        data: { object: remoteRefund },
        livemode: false,
        pending_webhooks: 1,
        request: { id: null, idempotency_key: null },
        type: "refund.updated",
      };
      await postWebhookRaw({ appOrigin, webhookSecret, event: refundEvent });
    }

    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/split-missions/" + fixture.batch.id + "/refund",
      method: "POST",
      body: refundBody,
    });

    ({ data: refundRow, error: refundRowError } = await admin
      .from("platform_held_group_refunds")
      .select("*")
      .eq("group_settlement_id", parent.id)
      .eq("request_key", requestKey)
      .single());
    if (refundRowError) throw new Error(refundRowError.message);
    assert(refundRow.state === "succeeded", "Local partial refund did not finalize.");

    const { data: allocation, error: allocationError } = await admin
      .from("platform_held_group_refund_allocations")
      .select("*")
      .eq("refund_id", refundRow.id)
      .eq("member_id", refreshedA.id)
      .single();
    if (allocationError) throw new Error(allocationError.message);

    const feeRefund = Number(allocation.platform_fee_refund_cents);
    const providerRefund = Number(allocation.provider_refund_cents);
    assert(
      feeRefund + providerRefund === partialGross,
      "Server-derived partial refund economics do not reconcile."
    );
    assert(
      providerRefund > 0,
      "Partial refund must require a provider reversal for released executor A."
    );

    const reversals = await stripe.transfers.listReversals(transferA.id, { limit: 100 });
    const matchingReversals = reversals.data.filter(
      (row) => row.metadata?.group_refund_allocation_id === allocation.id
    );
    assert(matchingReversals.length === 1, "Partial reversal was duplicated or missing.");
    assert(
      matchingReversals[0].amount === providerRefund,
      "Partial reversal amount mismatch."
    );

    const refunds = await stripe.refunds.list({
      payment_intent: paidIntent.id,
      limit: 100,
    });
    const matchingRefunds = refunds.data.filter(
      (row) => row.metadata?.group_refund_id === refundRow.id
    );
    assert(matchingRefunds.length === 1, "Customer partial refund was duplicated or missing.");
    assert(matchingRefunds[0].amount === partialGross, "Customer refund amount mismatch.");

    parent = await loadParent(admin, fixture.batch.id);
    members = await loadMembers(admin, parent.id);
    let finalA = members.find((member) => member.id === refreshedA.id);
    let finalB = members.find((member) => member.id === memberB.id);

    assert(Number(parent.refunded_amount_cents) === partialGross, "Parent refunded total mismatch.");
    assert(Number(finalA.reversed_amount_cents) === providerRefund, "Member reversal accounting mismatch.");
    assert(Number(finalA.refunded_gross_amount_cents) === partialGross, "Member refund accounting mismatch.");
    assert(finalB.state === "review_required", "Blocked executor B state was lost after sibling refund.");

    // Total refund = all remaining frozen economics. The already released
    // executor A must be reversed for its exact remaining provider amount;
    // executor B never received a Transfer, so no reversal is created for B.
    const totalRequestKey = "network-total-" + randomUUID();
    const totalRefundBody = {
      kind: "total",
      requestKey: totalRequestKey,
    };

    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/split-missions/" + fixture.batch.id + "/refund",
      method: "POST",
      body: totalRefundBody,
    });

    let { data: totalRefundRow, error: totalRefundError } = await admin
      .from("platform_held_group_refunds")
      .select("*")
      .eq("group_settlement_id", parent.id)
      .eq("request_key", totalRequestKey)
      .single();
    if (totalRefundError) throw new Error(totalRefundError.message);
    assert(
      totalRefundRow.stripe_refund_id?.startsWith("re_"),
      "Stripe total refund id missing."
    );

    let remoteTotalRefund = await stripe.refunds.retrieve(
      totalRefundRow.stripe_refund_id
    );
    for (
      let attempt = 0;
      attempt < 20 && remoteTotalRefund.status === "pending";
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      remoteTotalRefund = await stripe.refunds.retrieve(
        totalRefundRow.stripe_refund_id
      );
    }
    assert(
      remoteTotalRefund.status === "succeeded",
      "Stripe total remainder refund did not succeed."
    );

    if (totalRefundRow.state !== "succeeded") {
      const totalRefundEvent = {
        id:
          "evt_test_group_total_refund_" +
          randomUUID().replaceAll("-", ""),
        object: "event",
        created: Math.floor(Date.now() / 1000),
        data: { object: remoteTotalRefund },
        livemode: false,
        pending_webhooks: 1,
        request: { id: null, idempotency_key: null },
        type: "refund.updated",
      };
      await postWebhookRaw({
        appOrigin,
        webhookSecret,
        event: totalRefundEvent,
      });
    }

    // Same request key after terminal refund must reconcile, never mint another
    // customer refund or recalculate a new allocation plan.
    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/split-missions/" + fixture.batch.id + "/refund",
      method: "POST",
      body: totalRefundBody,
    });

    ({ data: totalRefundRow, error: totalRefundError } = await admin
      .from("platform_held_group_refunds")
      .select("*")
      .eq("group_settlement_id", parent.id)
      .eq("request_key", totalRequestKey)
      .single());
    if (totalRefundError) throw new Error(totalRefundError.message);
    assert(
      totalRefundRow.state === "succeeded",
      "Local total refund did not finalize."
    );

    const { data: totalAllocations, error: totalAllocationError } =
      await admin
        .from("platform_held_group_refund_allocations")
        .select("*")
        .eq("refund_id", totalRefundRow.id);
    if (totalAllocationError) {
      throw new Error(totalAllocationError.message);
    }
    assert(
      (totalAllocations ?? []).length === 2,
      "Total refund must allocate the remaining economics of both executors."
    );

    const allCustomerRefunds = await stripe.refunds.list({
      payment_intent: paidIntent.id,
      limit: 100,
    });
    const groupCustomerRefunds = allCustomerRefunds.data.filter(
      (row) =>
        row.status !== "failed" &&
        row.metadata?.payment_mode === PAYMENT_MODE &&
        row.metadata?.group_settlement_id === parent.id
    );
    const totalCustomerRefunded = groupCustomerRefunds.reduce(
      (sum, row) => sum + row.amount,
      0
    );
    assert(
      totalCustomerRefunded === Number(parent.gross_amount_cents),
      "Partial + total Stripe refunds do not exactly equal the captured group charge."
    );

    const allAReversals = await stripe.transfers.listReversals(
      transferA.id,
      { limit: 100 }
    );
    const groupAReversals = allAReversals.data.filter(
      (row) =>
        row.metadata?.payment_mode === PAYMENT_MODE &&
        row.metadata?.group_settlement_id === parent.id
    );
    const totalAReversed = groupAReversals.reduce(
      (sum, row) => sum + row.amount,
      0
    );

    parent = await loadParent(admin, fixture.batch.id);
    members = await loadMembers(admin, parent.id);
    finalA = members.find((member) => member.id === refreshedA.id);
    finalB = members.find((member) => member.id === memberB.id);

    assert(parent.state === "refunded", "Parent did not reach refunded.");
    assert(
      Number(parent.refunded_amount_cents) ===
        Number(parent.gross_amount_cents),
      "Parent total refunded amount does not equal captured gross."
    );
    assert(
      members.reduce(
        (sum, member) =>
          sum + Number(member.refunded_gross_amount_cents),
        0
      ) === Number(parent.gross_amount_cents),
      "Member refund gross totals do not reconcile to parent gross."
    );
    assert(
      totalAReversed === Number(finalA.provider_amount_cents) &&
        Number(finalA.reversed_amount_cents) ===
          Number(finalA.provider_amount_cents),
      "Released executor A was not fully reversed across partial + total refunds."
    );
    assert(
      !finalB.stripe_transfer_id &&
        Number(finalB.reversed_amount_cents) === 0 &&
        Number(finalB.refunded_gross_amount_cents) ===
          Number(finalB.gross_amount_cents),
      "Unreleased executor B refund accounting required an invalid reversal."
    );
    assert(
      finalB.state === "review_required",
      "Blocked executor B review state was corrupted by sibling/total refunds."
    );

    assert(
      concurrencyProof &&
        concurrencyProof.concurrentReleaseCount === 2 &&
        concurrencyProof.transferredAmountCents ===
          concurrencyProof.providerAmountCapCents,
      "Concurrent release proof is incomplete."
    );

    fs.mkdirSync("stripe-network-proof", { recursive: true });
    fs.writeFileSync(
      PROOF_PATH,
      JSON.stringify(
        {
          verified: true,
          flow: FLOW,
          stripeTestOnly: true,
          batchId: fixture.batch.id,
          groupSettlementId: parent.id,
          grossAmountCents: Number(parent.gross_amount_cents),
          platformFeeCents: Number(parent.platform_fee_cents),
          providerAmountCents: Number(parent.provider_amount_cents),
          executorCount: 2,
          childBookingCount: 3,
          onePlatformCharge: true,
          chargeId,
          transferGroup: parent.transfer_group,
          executorA: {
            memberId: finalA.id,
            transferId: transferA.id,
            transferAmountCents: transferA.amount,
            idempotentTransferCount: aTransfers.length,
            reversedAmountCents: Number(finalA.reversed_amount_cents),
          },
          executorB: {
            memberId: finalB.id,
            state: finalB.state,
            stripeAccountDisabledBeforeRelease: true,
            transferCreated: false,
          },
          partialRefund: {
            stripeRefundId: matchingRefunds[0].id,
            grossRefundCents: partialGross,
            platformFeeRefundCents: feeRefund,
            providerReversalCents: providerRefund,
            reversalCount: matchingReversals.length,
            refundCount: matchingRefunds.length,
            serverDerivedAllocation: true,
          },
          totalRefund: {
            stripeRefundId: totalRefundRow.stripe_refund_id,
            remainingRefundCents: Number(totalRefundRow.amount_cents),
            totalCustomerRefundedCents: totalCustomerRefunded,
            totalCustomerRefundCount: groupCustomerRefunds.length,
            executorAReversalTotalCents: totalAReversed,
            executorAReversalCount: groupAReversals.length,
            finalParentState: parent.state,
          },
          concurrency: concurrencyProof,
          preReleaseRefund: preReleaseRefundProof,
          aggregateReleaseCents: remoteTransfers.data.reduce(
            (sum, transfer) => sum + transfer.amount,
            0
          ),
          aggregateReleaseCapCents: Number(parent.provider_amount_cents),
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    process.stdout.write(
      JSON.stringify({
        verified: true,
        flow: FLOW,
        grossAmountCents: Number(parent.gross_amount_cents),
        executorCount: 2,
        transferCount: remoteTransfers.data.length,
        blockedExecutorIsolated: true,
        concurrentReleasesProved: true,
        concurrentReleaseCount: concurrencyProof.concurrentReleaseCount,
        preReleaseRefundNetTransferProved:
          preReleaseRefundProof?.actualTransferAmountCents ===
          preReleaseRefundProof?.expectedTransferAmountCents,
        partialRefundCents: partialGross,
        totalRefundedCents: Number(parent.refunded_amount_cents),
        finalParentState: parent.state,
      }) + "\n"
    );
  } finally {
    for (const sessionId of [
      checkoutSessionId,
      concurrencyCheckoutSessionId,
      preReleaseRefundCheckoutSessionId,
    ]) {
      if (!sessionId) continue;
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.status === "open") {
          await stripe.checkout.sessions.expire(sessionId);
        }
      } catch {}
    }

    if (stripeA?.id) {
      await closeRecipient(stripe, stripeA.id);
    }
    if (stripeB?.id && !stripeBClosed) {
      await closeRecipient(stripe, stripeB.id);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("KLYX Platform-Held multi-executor Stripe network proof failed: " + message);
  process.exitCode = 1;
});
