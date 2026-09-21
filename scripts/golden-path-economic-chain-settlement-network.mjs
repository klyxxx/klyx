import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";
const PAYMENT_MODE = "platform_held";
const PROOF_DIR = "stripe-network-proof";
const HANDOFF_PATH =
  `${PROOF_DIR}/platform-held-provider-fixture.json`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stripeObjectId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function v2TransferStatus(account) {
  return (
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? null
  );
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
  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }
  if (profileId) {
    requestHeaders.Cookie =
      `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`;
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
  const payload = raw ? JSON.parse(raw) : null;

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${method} ${path} returned ${response.status}: ${payload?.error ?? "unexpected response"}`
    );
  }

  return { status: response.status, payload };
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

async function postSignedWebhook({
  appOrigin,
  webhookSecret,
  event,
}) {
  const signed = signedStripeEvent(event, webhookSecret);
  return requestJson({
    appOrigin,
    path: "/api/stripe/webhook",
    method: "POST",
    body: signed.raw,
    headers: { "stripe-signature": signed.signature },
  });
}

async function authenticate(userClient, email, password) {
  const { data, error } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session?.access_token) {
    throw new Error(
      `Unable to authenticate economic-chain proof: ${error?.message ?? "missing session"}`
    );
  }
  return data.session.access_token;
}

async function loadProfiles(admin, ownerUserId) {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, account_id, account_type, country_code, currency_code"
    )
    .eq("owner_user_id", ownerUserId);

  if (error) throw new Error(error.message);

  const client = (data ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (data ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  assert(client && provider, "Economic-chain profiles are missing.");
  assert(
    provider.account_id &&
      provider.account_id === client.account_id,
    "Economic-chain profiles must resolve to one canonical account."
  );

  return {
    client,
    provider,
    accountId: provider.account_id,
  };
}

function loadHandoff(providerId) {
  assert(
    fs.existsSync(HANDOFF_PATH),
    "Stripe TEST recipient handoff is missing."
  );

  const handoff = JSON.parse(
    fs.readFileSync(HANDOFF_PATH, "utf8")
  );
  assert(handoff?.testMode === true, "Stripe handoff is not TEST-only.");
  assert(
    handoff?.providerProfileId === providerId,
    "Stripe handoff provider mismatch."
  );
  assert(
    typeof handoff?.accountId === "string" &&
      handoff.accountId.startsWith("acct_"),
    "Stripe handoff account id is invalid."
  );
  return handoff;
}

async function loadRealStripeRecipient(stripe, providerId) {
  const handoff = loadHandoff(providerId);
  const v2 = await stripe.v2.core.accounts.retrieve(
    handoff.accountId,
    {
      include: [
        "configuration.recipient",
        "identity",
        "requirements",
      ],
    }
  );
  const legacy = await stripe.accounts.retrieve(handoff.accountId);

  // Accounts v2 is the authoritative runtime-mode fact for this recipient.
  // The v1 Account compatibility projection does not reliably expose a
  // livemode field for Accounts v2-created recipients, so absence there must
  // never be misclassified as LIVE. The process is also guarded by sk_test_*.
  assert(v2.livemode === false, "Recipient unexpectedly uses LIVE.");
  assert(
    legacy.id === handoff.accountId && v2.id === handoff.accountId,
    "Stripe recipient projections disagree on the canonical account id."
  );
  assert(
    v2?.configuration?.recipient?.applied === true,
    "Stripe TEST recipient configuration is not applied."
  );
  assert(
    v2TransferStatus(v2) === "active",
    "Stripe TEST transfer capability is not active."
  );
  assert(
    legacy.details_submitted === true,
    "Stripe TEST details_submitted is not green."
  );
  assert(
    legacy.payouts_enabled === true,
    "Stripe TEST payouts_enabled is not green."
  );
  assert(
    legacy.requirements?.currently_due?.length === 0,
    "Stripe TEST still has currently_due requirements."
  );
  assert(
    legacy.requirements?.past_due?.length === 0,
    "Stripe TEST still has past_due requirements."
  );

  return {
    legacy,
    v2,
    createdForProof: handoff.created === true,
  };
}

async function bindCanonicalStripe({
  admin,
  accountId,
  providerId,
  stripeAccountId,
}) {
  const now = new Date().toISOString();

  const { error: resetError } = await admin
    .from("account_stripe_connect_identities")
    .delete()
    .eq("account_id", accountId);
  if (resetError) throw new Error(resetError.message);

  const { error: identityError } = await admin
    .from("account_stripe_connect_identities")
    .insert({
      account_id: accountId,
      stripe_account_id: stripeAccountId,
      identity_state: "linked",
      source_profile_ids: [providerId],
      conflicting_stripe_account_ids: [],
      updated_at: now,
    });
  if (identityError) throw new Error(identityError.message);

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      stripe_account_id: stripeAccountId,
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
      updated_at: now,
    })
    .eq("id", providerId)
    .eq("account_id", accountId);
  if (profileError) throw new Error(profileError.message);
}

async function latestAcceptedUnpaidBooking(
  admin,
  clientId,
  providerId
) {
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, user_service_id, service_id, country_code, status, payment_status, payment_mode, amount_total, currency"
    )
    .eq("parent_id", clientId)
    .eq("provider_id", providerId)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Accepted unpaid certification booking missing."
    );
  }
  return data;
}

async function loadSettlement(admin, bookingId) {
  const { data, error } = await admin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, transfer_group, state, release_reason_codes"
    )
    .eq("booking_id", bookingId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function createPaidHeldBooking({
  stripe,
  admin,
  appOrigin,
  accessToken,
  webhookSecret,
  client,
  provider,
}) {
  const booking = await latestAcceptedUnpaidBooking(
    admin,
    client.id,
    provider.id
  );

  const checkout = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/stripe/create-checkout-session",
    method: "POST",
    body: { bookingId: booking.id },
  });
  assert(
    checkout.payload?.paymentMode === PAYMENT_MODE,
    "Checkout did not use platform_held."
  );

  let settlement = await loadSettlement(admin, booking.id);
  assert(
    settlement.state === "pending_payment",
    "Settlement did not start pending_payment."
  );

  const intent = await stripe.paymentIntents.create(
    {
      amount: Number(settlement.gross_amount_cents),
      currency: String(settlement.currency).toLowerCase(),
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      transfer_group: settlement.transfer_group,
      metadata: {
        booking_id: booking.id,
        provider_id: provider.id,
        payment_mode: PAYMENT_MODE,
        settlement_transfer_group: settlement.transfer_group,
        settlement_provider_profile_id: provider.id,
        settlement_provider_stripe_account_id:
          settlement.stripe_account_id,
        klyx_network_proof: "economic_chain",
      },
    },
    {
      idempotencyKey:
        `klyx-economic-chain-payment-${booking.id}`,
    }
  );

  const refreshed = await stripe.paymentIntents.retrieve(intent.id, {
    expand: ["latest_charge"],
  });
  const chargeId = stripeObjectId(refreshed.latest_charge);

  assert(
    refreshed.livemode === false &&
      refreshed.status === "succeeded" &&
      chargeId?.startsWith("ch_"),
    "Real Stripe TEST charge was not created."
  );

  const event = {
    id:
      `evt_test_klyx_economic_${randomUUID().replaceAll("-", "")}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: settlement.stripe_checkout_session_id,
        object: "checkout.session",
        amount_total: settlement.gross_amount_cents,
        currency: String(settlement.currency).toLowerCase(),
        metadata: {
          booking_id: booking.id,
          provider_id: provider.id,
          payment_mode: PAYMENT_MODE,
          settlement_transfer_group: settlement.transfer_group,
        },
        mode: "payment",
        payment_intent: refreshed.id,
        payment_status: "paid",
        status: "complete",
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  };

  const webhook = await postSignedWebhook({
    appOrigin,
    webhookSecret,
    event,
  });
  assert(
    webhook.payload?.received === true,
    "KLYX did not accept the signed payment webhook."
  );

  const { data: attached, error: attachError } = await admin.rpc(
    "klyx_attach_booking_settlement_stripe_truth",
    {
      p_booking_id: booking.id,
      p_checkout_session_id: settlement.stripe_checkout_session_id,
      p_payment_intent_id: refreshed.id,
      p_charge_id: chargeId,
    }
  );
  if (attachError) throw new Error(attachError.message);
  assert(attached === true, "Stripe truth attachment failed.");

  settlement = await loadSettlement(admin, booking.id);
  assert(
    settlement.state === "held",
    `Settlement did not enter held state: ${settlement.state}`
  );

  return {
    booking,
    settlement,
    paymentIntentId: refreshed.id,
    chargeId,
  };
}

async function bookingEconomicContext(admin, booking) {
  let serviceId = booking.service_id ?? null;

  if (!serviceId && booking.user_service_id) {
    const { data, error } = await admin
      .from("user_services")
      .select("service_id")
      .eq("id", booking.user_service_id)
      .single();
    if (error) throw new Error(error.message);
    serviceId = data.service_id;
  }

  assert(serviceId, "Booking service id is missing.");

  const { data: service, error } = await admin
    .from("services")
    .select("slug")
    .eq("id", serviceId)
    .single();
  if (error) throw new Error(error.message);

  return {
    activityKey: String(service.slug).trim().toLowerCase(),
    jurisdictionCode:
      String(booking.country_code ?? "").trim().toUpperCase(),
    userServiceId: booking.user_service_id ?? null,
  };
}

async function clearEconomicFacts(admin, accountId, identityId) {
  for (const operation of [
    admin
      .from("economic_restrictions")
      .delete()
      .eq("economic_identity_id", identityId),
    admin
      .from("economic_verification_cases")
      .delete()
      .eq("economic_identity_id", identityId),
    admin
      .from("economic_persons")
      .delete()
      .eq("economic_identity_id", identityId),
    admin
      .from("economic_legal_entities")
      .delete()
      .eq("economic_identity_id", identityId),
    admin
      .from("account_capability_qualifications")
      .delete()
      .eq("account_id", accountId)
      .eq("capability", "offer_services"),
  ]) {
    const { error } = await operation;
    if (error) throw new Error(error.message);
  }
}

async function establishVerifiedEconomicChain({
  admin,
  accountId,
  providerId,
  stripeAccount,
  booking,
}) {
  const { data: identity, error: identityReadError } = await admin
    .from("economic_identities")
    .select("id")
    .eq("account_id", accountId)
    .single();
  if (identityReadError) throw new Error(identityReadError.message);

  const context = await bookingEconomicContext(admin, booking);
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await clearEconomicFacts(admin, accountId, identity.id);

  const { error: identityError } = await admin
    .from("economic_identities")
    .update({
      status: "ready",
      primary_country_code: context.jurisdictionCode,
      human_review_required: false,
      review_reason_code: null,
      updated_at: now.toISOString(),
    })
    .eq("id", identity.id);
  if (identityError) throw new Error(identityError.message);

  const { error: capabilityError } = await admin
    .from("account_actor_capabilities")
    .upsert(
      {
        account_id: accountId,
        capability: "offer_services",
        enabled: true,
        source: "system",
        updated_at: now.toISOString(),
      },
      { onConflict: "account_id,capability" }
    );
  if (capabilityError) throw new Error(capabilityError.message);

  const { data: legalEntity, error: legalEntityError } = await admin
    .from("economic_legal_entities")
    .insert({
      economic_identity_id: identity.id,
      entity_type: "individual",
      is_primary: true,
      legal_name: "KLYX Stripe TEST Economic Chain",
      country_code: context.jurisdictionCode,
      source: "trusted_provider",
      external_provider: "stripe_test",
      external_reference: `entity:${booking.id}`,
      verification_status: "verified",
      verified_at: now.toISOString(),
      expires_at: future.toISOString(),
    })
    .select("id")
    .single();
  if (legalEntityError) throw new Error(legalEntityError.message);

  const { data: person, error: personError } = await admin
    .from("economic_persons")
    .insert({
      economic_identity_id: identity.id,
      legal_entity_id: legalEntity.id,
      relationship: "self",
      is_primary: true,
      source: "trusted_provider",
      external_provider: "stripe_test",
      external_reference: `person:${booking.id}`,
      verification_status: "verified",
      verified_at: now.toISOString(),
      expires_at: future.toISOString(),
    })
    .select("id")
    .single();
  if (personError) throw new Error(personError.message);

  const { error: verificationError } = await admin
    .from("economic_verification_cases")
    .insert({
      economic_identity_id: identity.id,
      legal_entity_id: legalEntity.id,
      economic_person_id: person.id,
      verification_type: "kyc",
      provider: "stripe_test",
      external_reference: `kyc:${booking.id}`,
      requirement_key: "identity",
      status: "verified",
      decision_source: "trusted_provider",
      reason_code: "stripe_test_verified",
      human_review_required: false,
      verified_at: now.toISOString(),
      expires_at: future.toISOString(),
      provider_observed_at: now.toISOString(),
    });
  if (verificationError) throw new Error(verificationError.message);

  const { error: qualificationError } = await admin
    .from("account_capability_qualifications")
    .insert({
      account_id: accountId,
      capability: "offer_services",
      qualification_key: "economic_chain_certified",
      scope_type: "user_service",
      scope_key: context.userServiceId,
      status: "approved",
      source: "system",
      evidence: { stripeTestCertification: true },
      valid_from: now.toISOString(),
      valid_until: future.toISOString(),
      activity_key: context.activityKey,
      jurisdiction_code: context.jurisdictionCode,
    });
  if (qualificationError) throw new Error(qualificationError.message);

  const { error: trustError } = await admin
    .from("trust_eligibility_decisions")
    .insert({
      account_id: accountId,
      target_type: "booking",
      target_ref: booking.id,
      category_key: context.activityKey,
      jurisdiction_code: context.jurisdictionCode,
      decision: "eligible",
      legal_pathway: "independent_compatible",
      decision_source: "policy_engine",
      human_review_required: false,
      review_status: "not_required",
      reason_codes: [],
      required_actions: [],
      explanation:
        "Stripe TEST economic-chain verified certification.",
      input_snapshot: { certification: true, providerId },
      expires_at: future.toISOString(),
    });
  if (trustError) throw new Error(trustError.message);

  const { error: projectionError } = await admin
    .from("economic_stripe_account_projections")
    .upsert(
      {
        economic_identity_id: identity.id,
        account_id: accountId,
        stripe_account_id: stripeAccount.id,
        country_code: stripeAccount.country,
        business_type: stripeAccount.business_type,
        details_submitted: stripeAccount.details_submitted,
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
        currently_due:
          stripeAccount.requirements?.currently_due ?? [],
        eventually_due:
          stripeAccount.requirements?.eventually_due ?? [],
        past_due: stripeAccount.requirements?.past_due ?? [],
        pending_verification:
          stripeAccount.requirements?.pending_verification ?? [],
        requirement_errors:
          stripeAccount.requirements?.errors ?? [],
        disabled_reason:
          stripeAccount.requirements?.disabled_reason ?? null,
        capabilities: stripeAccount.capabilities ?? {},
        provider_observed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "economic_identity_id" }
    );
  if (projectionError) throw new Error(projectionError.message);

  return {
    identityId: identity.id,
    ...context,
  };
}

async function addCountryRestriction(admin, identityId, jurisdictionCode) {
  const { error } = await admin
    .from("economic_restrictions")
    .insert({
      economic_identity_id: identityId,
      restricted_action: "receive_settlement",
      scope_type: "jurisdiction",
      activity_key: null,
      jurisdiction_code: jurisdictionCode,
      status: "active",
      source: "deterministic_rule",
      reason_code: "country_restricted",
      human_review_required: false,
    });
  if (error) throw new Error(error.message);
}

async function insertRiskAllow(admin, accountId, bookingId) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("transaction_risk_decisions")
    .insert({
      account_id: accountId,
      action: "settlement_release",
      participant: "settlement_recipient",
      decision: "allow",
      reason_codes: [],
      risk_score: 0,
      risk_level: "low",
      risk_assessed_at: now,
      subject_type: "booking",
      subject_id: bookingId,
      deduplication_key:
        `economic-chain:settlement:${bookingId}:${randomUUID()}`,
    });
  if (error) throw new Error(error.message);
}

async function progressToCompletion({
  admin,
  appOrigin,
  accessToken,
  client,
  provider,
  bookingId,
}) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const now = new Date().toISOString();

  const { error: prepError } = await admin
    .from("bookings")
    .update({
      booking_date: yesterday,
      start_time: "10:00",
      service_status: "in_progress",
      started_at: now,
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", "accepted")
    .eq("payment_status", "paid");
  if (prepError) throw new Error(prepError.message);

  await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/bookings/tracking",
    method: "POST",
    body: {
      bookingId,
      action: "provider_finished",
      note: "Economic-chain Stripe TEST certification.",
    },
  });

  await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/tracking",
    method: "POST",
    body: {
      bookingId,
      action: "client_confirmed",
      note: "Economic-chain Stripe TEST certification.",
    },
  });
}

async function latestEconomicDecision(admin, bookingId) {
  const { data, error } = await admin
    .from("economic_settlement_eligibility_decisions")
    .select("decision, reason_codes, stripe_account_id, evaluated_at")
    .eq("subject_type", "booking")
    .eq("subject_id", bookingId)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function transferMatches(stripe, settlement) {
  const result = await stripe.transfers.list({
    transfer_group: settlement.transfer_group,
    destination: settlement.stripe_account_id,
    limit: 10,
  });
  return result.data.filter(
    (transfer) =>
      transfer.metadata?.booking_id === settlement.booking_id &&
      transfer.metadata?.payment_mode === PAYMENT_MODE
  );
}

function createNextLifecycleBooking() {
  const child = spawnSync(
    process.execPath,
    ["scripts/golden-path-client-lifecycle.mjs"],
    { stdio: "inherit", env: process.env }
  );
  if (child.status !== 0) {
    throw new Error(
      `Second economic-chain lifecycle failed with ${child.status}.`
    );
  }
}

async function refundPayment(stripe, paymentIntentId, key) {
  const existing = await stripe.refunds.list({
    payment_intent: paymentIntentId,
    limit: 10,
  });
  if (existing.data.length > 0) return existing.data[0];

  return stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      metadata: { klyx_network_proof: "economic_chain_cleanup" },
    },
    { idempotencyKey: key }
  );
}

async function main() {
  const { e2eOrigin, localSupabase } =
    assertGoldenPathIsolation();
  assert(
    localSupabase,
    "Economic-chain proof requires ephemeral local Supabase."
  );

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;
  assert(
    appOrigin === "http://127.0.0.1:3100",
    "Economic-chain proof requires isolated KLYX."
  );

  const stripeSecret = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const publishable = requiredGoldenPathEnv(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  );
  const webhookSecret = requiredGoldenPathEnv(
    "STRIPE_WEBHOOK_SECRET"
  );
  assert(
    stripeSecret.startsWith("sk_test_") &&
      publishable.startsWith("pk_test_"),
    "Economic-chain certification is Stripe TEST-only."
  );
  assert(
    process.env.KLYX_STRIPE_MODE === "test" &&
      process.env.KLYX_STRIPE_SETTLEMENT_MODE === PAYMENT_MODE &&
      process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY === "true" &&
      process.env.KLYX_LIVE_PAYMENTS_ENABLED === "false",
    "Economic-chain TEST-only settlement guards are not armed."
  );

  const serviceRole = requiredGoldenPathEnv(
    "SUPABASE_SERVICE_ROLE_KEY"
  );
  const supabasePublic = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userClient = createClient(e2eOrigin, supabasePublic, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const stripe = new Stripe(stripeSecret);

  let accessToken = await authenticate(
    userClient,
    email,
    password
  );
  const { data: userData, error: userError } =
    await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    throw new Error(userError?.message ?? "Auth user missing.");
  }

  const { client, provider, accountId } = await loadProfiles(
    admin,
    userData.user.id
  );

  let recipient = null;
  let cleanupFailure = null;
  const cleanupIntents = [];
  let releasedTransfer = null;

  try {
    recipient = await loadRealStripeRecipient(
      stripe,
      provider.id
    );
    await bindCanonicalStripe({
      admin,
      accountId,
      providerId: provider.id,
      stripeAccountId: recipient.legacy.id,
    });

    const blockedPayment = await createPaidHeldBooking({
      stripe,
      admin,
      appOrigin,
      accessToken,
      webhookSecret,
      client,
      provider,
    });
    cleanupIntents.push(blockedPayment.paymentIntentId);

    const blockedContext = await establishVerifiedEconomicChain({
      admin,
      accountId,
      providerId: provider.id,
      stripeAccount: recipient.legacy,
      booking: blockedPayment.booking,
    });
    await addCountryRestriction(
      admin,
      blockedContext.identityId,
      blockedContext.jurisdictionCode
    );

    const blockedBefore = await transferMatches(
      stripe,
      blockedPayment.settlement
    );
    assert(
      blockedBefore.length === 0,
      "Blocked scenario already had a Transfer."
    );

    await progressToCompletion({
      admin,
      appOrigin,
      accessToken,
      client,
      provider,
      bookingId: blockedPayment.booking.id,
    });

    const blockedSettlement = await loadSettlement(
      admin,
      blockedPayment.booking.id
    );
    const blockedDecision = await latestEconomicDecision(
      admin,
      blockedPayment.booking.id
    );
    const blockedAfter = await transferMatches(
      stripe,
      blockedPayment.settlement
    );

    assert(
      blockedDecision.decision === "blocked",
      `Expected KLYX blocked, got ${blockedDecision.decision}.`
    );
    assert(
      (blockedDecision.reason_codes ?? []).includes(
        "ECONOMIC_RESTRICTION_ACTIVE"
      ),
      "Country restriction reason code is missing."
    );
    assert(
      blockedDecision.stripe_account_id === recipient.legacy.id,
      "Blocked decision did not evaluate the green Stripe recipient."
    );
    assert(
      blockedSettlement.state === "review_required",
      `Blocked settlement state is ${blockedSettlement.state}.`
    );
    assert(
      blockedAfter.length === 0,
      "KLYX blocked eligibility still created a Stripe Transfer."
    );

    createNextLifecycleBooking();
    accessToken = await authenticate(
      userClient,
      email,
      password
    );

    const verifiedPayment = await createPaidHeldBooking({
      stripe,
      admin,
      appOrigin,
      accessToken,
      webhookSecret,
      client,
      provider,
    });
    cleanupIntents.push(verifiedPayment.paymentIntentId);

    await establishVerifiedEconomicChain({
      admin,
      accountId,
      providerId: provider.id,
      stripeAccount: recipient.legacy,
      booking: verifiedPayment.booking,
    });
    await insertRiskAllow(
      admin,
      accountId,
      verifiedPayment.booking.id
    );

    await progressToCompletion({
      admin,
      appOrigin,
      accessToken,
      client,
      provider,
      bookingId: verifiedPayment.booking.id,
    });

    const verifiedSettlement = await loadSettlement(
      admin,
      verifiedPayment.booking.id
    );
    const verifiedDecision = await latestEconomicDecision(
      admin,
      verifiedPayment.booking.id
    );
    const verifiedTransfers = await transferMatches(
      stripe,
      verifiedPayment.settlement
    );

    assert(
      verifiedDecision.decision === "allowed",
      `Verified economic chain was not allowed: ${verifiedDecision.decision}.`
    );
    assert(
      verifiedSettlement.state === "released",
      `Verified settlement did not release: ${verifiedSettlement.state}.`
    );
    assert(
      verifiedTransfers.length === 1,
      `Verified chain expected exactly one Transfer, found ${verifiedTransfers.length}.`
    );

    releasedTransfer = verifiedTransfers[0];
    assert(
      releasedTransfer.id === verifiedSettlement.stripe_transfer_id,
      "DB/Stripe Transfer id mismatch."
    );
    assert(
      stripeObjectId(releasedTransfer.destination) ===
        recipient.legacy.id,
      "Verified Transfer destination mismatch."
    );
    assert(
      stripeObjectId(releasedTransfer.source_transaction) ===
        verifiedPayment.chargeId,
      "Verified Transfer source charge mismatch."
    );

    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(
      `${PROOF_DIR}/economic-chain-certification-proof.json`,
      `${JSON.stringify(
        {
          verified: true,
          stripeTestNetwork: true,
          liveMode: false,
          canonicalAccountIdUsed: true,
          chain: [
            "account",
            "economic_identity",
            "legal_person_entity",
            "kyc_kyb",
            "stripe_projection",
            "qualifications",
            "activity_eligibility",
            "economic_eligibility",
            "settlement",
          ],
          stripeGreen: {
            accountId: recipient.legacy.id,
            detailsSubmitted: true,
            payoutsEnabled: true,
            requirementsCurrentlyDue: 0,
            requirementsPastDue: 0,
            recipientTransferCapability: "active",
          },
          blockedProof: {
            bookingId: blockedPayment.booking.id,
            decision: blockedDecision.decision,
            reasonCodes: blockedDecision.reason_codes,
            settlementState: blockedSettlement.state,
            transferCount: blockedAfter.length,
            invariant:
              "Stripe OK + KLYX BLOCKED => zero provider Transfer",
          },
          verifiedProof: {
            bookingId: verifiedPayment.booking.id,
            decision: verifiedDecision.decision,
            settlementState: verifiedSettlement.state,
            transferId: releasedTransfer.id,
            transferCount: verifiedTransfers.length,
          },
          certifiedAt: new Date().toISOString(),
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    process.stdout.write(
      `${JSON.stringify({
        verified: true,
        stripeTestNetwork: true,
        stripeOkKlyxBlockedZeroTransfer: true,
        verifiedChainReleasedExactlyOneTransfer: true,
        blockedDecision: blockedDecision.decision,
        blockedTransferCount: blockedAfter.length,
        verifiedDecision: verifiedDecision.decision,
        verifiedTransferCount: verifiedTransfers.length,
        liveForbidden: true,
      })}\n`
    );
  } finally {
    try {
      if (releasedTransfer) {
        const reversals = await stripe.transfers.listReversals(
          releasedTransfer.id,
          { limit: 10 }
        );
        if (reversals.data.length === 0) {
          await stripe.transfers.createReversal(
            releasedTransfer.id,
            {
              amount: releasedTransfer.amount,
              metadata: {
                klyx_network_proof: "economic_chain_cleanup",
              },
            },
            {
              idempotencyKey:
                `klyx-economic-chain-reversal-${releasedTransfer.id}`,
            }
          );
        }
      }

      for (const paymentIntentId of cleanupIntents) {
        await refundPayment(
          stripe,
          paymentIntentId,
          `klyx-economic-chain-refund-${paymentIntentId}`
        );
      }

      if (
        recipient?.createdForProof === true &&
        recipient?.legacy?.id
      ) {
        const refreshed = await stripe.v2.core.accounts.retrieve(
          recipient.legacy.id,
          {
            include: [
              "configuration.recipient",
              "identity",
              "requirements",
            ],
          }
        );
        const configurations =
          refreshed.applied_configurations ?? [];
        const closed = await stripe.v2.core.accounts.close(
          recipient.legacy.id,
          { applied_configurations: configurations }
        );
        assert(
          closed.closed === true,
          "Stripe TEST recipient closure was not confirmed."
        );
      }
    } catch (error) {
      cleanupFailure =
        error instanceof Error ? error.message : String(error);
    }

    await userClient.auth.signOut();
  }

  if (cleanupFailure) {
    throw new Error(
      `Economic-chain cleanup failed: ${cleanupFailure}`
    );
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : String(error);
  console.error(
    `KLYX economic-chain Stripe TEST proof failed: ${message}`
  );
  process.exitCode = 1;
});
