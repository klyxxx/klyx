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
const PROVIDER_FIXTURE_HANDOFF =
  `${PROOF_DIR}/platform-held-provider-fixture.json`;
const PROOF_PATH =
  `${PROOF_DIR}/economic-chain-stripe-ok-klyx-blocked-proof.json`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    headers: { "stripe-signature": signed.signature },
  });
}

function stripeObjectId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function asStringArray(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function v2TransferStatus(account) {
  return (
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? null
  );
}

function v2RecipientTransferReady(account) {
  return (
    account?.livemode === false &&
    account?.applied_configurations?.includes("recipient") === true &&
    account?.configuration?.recipient?.applied === true &&
    v2TransferStatus(account) === "active"
  );
}

function loadProviderFixtureHandoff(providerId) {
  assert(
    fs.existsSync(PROVIDER_FIXTURE_HANDOFF),
    "Platform-held provider fixture handoff is missing."
  );

  const handoff = JSON.parse(
    fs.readFileSync(PROVIDER_FIXTURE_HANDOFF, "utf8")
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

async function loadProfiles(admin, ownerUserId) {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, account_id, account_type, country_code, currency_code, stripe_account_id"
    )
    .eq("owner_user_id", ownerUserId);

  if (error) throw new Error(`Unable to load profiles: ${error.message}`);

  const client = (data ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (data ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  assert(client && provider, "Client/provider profiles are missing.");
  assert(provider.account_id, "Provider canonical account is missing.");
  assert(
    client.account_id === provider.account_id,
    "Golden-path profiles must share one canonical account."
  );

  return {
    client,
    provider,
    accountId: provider.account_id,
  };
}

async function loadUserService(admin, providerId) {
  const { data, error } = await admin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", providerId)
    .eq("active", true)
    .eq("provider_enabled", true)
    .limit(1)
    .single();

  if (error) throw new Error(`Unable to load user service: ${error.message}`);

  const { data: service, error: serviceError } = await admin
    .from("services")
    .select("slug")
    .eq("id", data.service_id)
    .single();

  if (serviceError) {
    throw new Error(`Unable to load service slug: ${serviceError.message}`);
  }

  return {
    userServiceId: data.id,
    activityKey: String(service.slug).trim().toLowerCase(),
  };
}

async function bindCanonicalStripeAccount({
  admin,
  accountId,
  providerId,
  stripeAccount,
}) {
  const { error: projectionDeleteError } = await admin
    .from("economic_stripe_account_projections")
    .delete()
    .eq("account_id", accountId);

  if (projectionDeleteError) {
    throw new Error(
      `Unable to clear stale Stripe projection: ${projectionDeleteError.message}`
    );
  }

  const { error: identityDeleteError } = await admin
    .from("account_stripe_connect_identities")
    .delete()
    .eq("account_id", accountId);

  if (identityDeleteError) {
    throw new Error(
      `Unable to clear canonical Stripe identity: ${identityDeleteError.message}`
    );
  }

  const { error: identityError } = await admin
    .from("account_stripe_connect_identities")
    .insert({
      account_id: accountId,
      stripe_account_id: stripeAccount.id,
      identity_state: "linked",
      source_profile_ids: [providerId],
      conflicting_stripe_account_ids: [],
      updated_at: new Date().toISOString(),
    });

  if (identityError) {
    throw new Error(
      `Unable to bind canonical Stripe identity: ${identityError.message}`
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      stripe_account_id: stripeAccount.id,
      stripe_onboarding_complete: Boolean(stripeAccount.details_submitted),
      stripe_charges_enabled: Boolean(stripeAccount.charges_enabled),
      stripe_payouts_enabled: Boolean(stripeAccount.payouts_enabled),
    })
    .eq("id", providerId)
    .eq("account_id", accountId);

  if (profileError) {
    throw new Error(
      `Unable to update profile Stripe compatibility: ${profileError.message}`
    );
  }
}

async function prepareEconomicBaseline({
  admin,
  accountId,
  providerId,
  stripeAccount,
  stripeLivemode,
  userServiceId,
  activityKey,
  jurisdictionCode,
  bookingId,
}) {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: identity, error: identityError } = await admin
    .from("economic_identities")
    .select("id")
    .eq("account_id", accountId)
    .single();

  if (identityError) {
    throw new Error(
      `Unable to load economic identity: ${identityError.message}`
    );
  }

  const economicIdentityId = identity.id;

  const { error: identityStateError } = await admin
    .from("economic_identities")
    .update({
      status: "ready",
      primary_country_code: jurisdictionCode,
      human_review_required: false,
      review_reason_code: null,
      updated_at: now,
    })
    .eq("id", economicIdentityId);

  if (identityStateError) {
    throw new Error(
      `Unable to prepare economic identity: ${identityStateError.message}`
    );
  }

  const { error: capabilityError } = await admin
    .from("account_actor_capabilities")
    .upsert(
      {
        account_id: accountId,
        capability: "offer_services",
        enabled: true,
        source: "system",
        metadata: {
          certification: "stripe_ok_klyx_blocked",
        },
        updated_at: now,
      },
      { onConflict: "account_id,capability" }
    );

  if (capabilityError) {
    throw new Error(
      `Unable to prepare offer-services capability: ${capabilityError.message}`
    );
  }

  const { error: legalDeleteError } = await admin
    .from("economic_legal_entities")
    .delete()
    .eq("economic_identity_id", economicIdentityId);

  if (legalDeleteError) {
    throw new Error(
      `Unable to reset legal subjects: ${legalDeleteError.message}`
    );
  }

  const { data: legalEntity, error: legalEntityError } = await admin
    .from("economic_legal_entities")
    .insert({
      economic_identity_id: economicIdentityId,
      entity_type: "individual",
      is_primary: true,
      legal_name: "KLYX Stripe TEST Economic Certification",
      country_code: jurisdictionCode,
      source: "account",
      verification_status: "verified",
      verified_at: now,
      expires_at: future,
    })
    .select("id")
    .single();

  if (legalEntityError) {
    throw new Error(
      `Unable to create verified legal subject: ${legalEntityError.message}`
    );
  }

  const { data: person, error: personError } = await admin
    .from("economic_persons")
    .insert({
      economic_identity_id: economicIdentityId,
      legal_entity_id: legalEntity.id,
      relationship: "self",
      is_primary: true,
      source: "account",
      verification_status: "verified",
      verified_at: now,
      expires_at: future,
    })
    .select("id")
    .single();

  if (personError) {
    throw new Error(
      `Unable to create verified economic person: ${personError.message}`
    );
  }

  const { error: verificationError } = await admin
    .from("economic_verification_cases")
    .insert({
      economic_identity_id: economicIdentityId,
      legal_entity_id: legalEntity.id,
      economic_person_id: person.id,
      verification_type: "kyc",
      provider: "stripe_test_certification",
      external_reference: `stripe-test-${randomUUID()}`,
      requirement_key: "settlement_identity",
      status: "verified",
      decision_source: "deterministic_rule",
      human_review_required: false,
      verified_at: now,
      expires_at: future,
      provider_observed_at: now,
    });

  if (verificationError) {
    throw new Error(
      `Unable to create verified KYC case: ${verificationError.message}`
    );
  }

  const { error: qualificationDeleteError } = await admin
    .from("account_capability_qualifications")
    .delete()
    .eq("account_id", accountId)
    .eq("capability", "offer_services")
    .eq("qualification_key", "stripe_test_certification");

  if (qualificationDeleteError) {
    throw new Error(
      `Unable to reset certification qualification: ${qualificationDeleteError.message}`
    );
  }

  const { error: qualificationError } = await admin
    .from("account_capability_qualifications")
    .insert({
      account_id: accountId,
      capability: "offer_services",
      qualification_key: "stripe_test_certification",
      scope_type: "user_service",
      scope_key: userServiceId,
      status: "approved",
      source: "system",
      evidence: {
        certification: "stripe_ok_klyx_blocked",
      },
      activity_key: activityKey,
      jurisdiction_code: jurisdictionCode,
      valid_from: new Date(Date.now() - 60_000).toISOString(),
      valid_until: future,
    });

  if (qualificationError) {
    throw new Error(
      `Unable to create approved qualification: ${qualificationError.message}`
    );
  }

  const requirements = stripeAccount.requirements ?? {};
  const currentlyDue = asStringArray(requirements.currently_due);
  const pastDue = asStringArray(requirements.past_due);
  const pendingVerification = asStringArray(
    requirements.pending_verification
  );
  const requirementErrors = Array.isArray(requirements.errors)
    ? requirements.errors
    : [];

  assert(
    stripeLivemode === false,
    "Stripe Accounts v2 truth unexpectedly uses LIVE mode."
  );
  assert(
    stripeAccount.details_submitted === true,
    "Stripe TEST account details are not submitted."
  );
  assert(
    stripeAccount.payouts_enabled === true,
    "Stripe TEST account payouts are not enabled."
  );
  assert(
    stripeAccount.capabilities?.transfers === "active",
    "Stripe TEST transfer capability is not active."
  );
  assert(
    currentlyDue.length === 0 &&
      pastDue.length === 0 &&
      pendingVerification.length === 0 &&
      requirementErrors.length === 0 &&
      !requirements.disabled_reason,
    "Stripe TEST account has unresolved requirements."
  );

  const { error: stripeProjectionError } = await admin
    .from("economic_stripe_account_projections")
    .insert({
      economic_identity_id: economicIdentityId,
      account_id: accountId,
      stripe_account_id: stripeAccount.id,
      country_code: stripeAccount.country ?? jurisdictionCode,
      business_type: stripeAccount.business_type ?? "individual",
      details_submitted: true,
      charges_enabled: Boolean(stripeAccount.charges_enabled),
      payouts_enabled: true,
      currently_due: currentlyDue,
      eventually_due: asStringArray(requirements.eventually_due),
      past_due: pastDue,
      pending_verification: pendingVerification,
      requirement_errors: requirementErrors,
      disabled_reason: requirements.disabled_reason ?? null,
      capabilities: {
        ...(stripeAccount.capabilities ?? {}),
        transfers: "active",
      },
      provider_observed_at: now,
      updated_at: now,
    });

  if (stripeProjectionError) {
    throw new Error(
      `Unable to persist Stripe economic projection: ${stripeProjectionError.message}`
    );
  }

  const { error: trustDecisionError } = await admin
    .from("trust_eligibility_decisions")
    .insert({
      account_id: accountId,
      target_type: "booking",
      target_ref: bookingId,
      category_key: activityKey,
      jurisdiction_code: jurisdictionCode,
      decision: "eligible",
      legal_pathway: "independent_compatible",
      decision_source: "policy_engine",
      human_review_required: false,
      review_status: "not_required",
      reason_codes: [],
      required_actions: [],
      explanation:
        "Real Stripe TEST recipient is otherwise eligible; country restriction is injected separately.",
      input_snapshot: {
        certification: "stripe_ok_klyx_blocked",
      },
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

  if (trustDecisionError) {
    throw new Error(
      `Unable to persist eligible activity decision: ${trustDecisionError.message}`
    );
  }

  const { error: restrictionError } = await admin
    .from("economic_restrictions")
    .insert({
      economic_identity_id: economicIdentityId,
      restricted_action: "receive_settlement",
      scope_type: "jurisdiction",
      jurisdiction_code: jurisdictionCode,
      status: "active",
      source: "deterministic_rule",
      reason_code: "certification_country_restricted",
      human_review_required: false,
      starts_at: now,
    });

  if (restrictionError) {
    throw new Error(
      `Unable to inject KLYX country restriction: ${restrictionError.message}`
    );
  }

  return {
    economicIdentityId,
    legalEntityId: legalEntity.id,
    economicPersonId: person.id,
  };
}

function createLifecycleBooking() {
  const child = spawnSync(
    process.execPath,
    ["scripts/golden-path-client-lifecycle.mjs"],
    {
      stdio: "inherit",
      env: process.env,
    }
  );

  if (child.status !== 0) {
    throw new Error(
      `Golden-path client lifecycle failed with exit code ${child.status}.`
    );
  }
}

async function latestAcceptedUnpaidBooking(admin, clientId, providerId) {
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, status, payment_status, payment_mode, booking_group_id"
    )
    .eq("parent_id", clientId)
    .eq("provider_id", providerId)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new Error(
      `Unable to locate accepted unpaid booking: ${error.message}`
    );
  }

  assert(data.booking_group_id === null, "Certification requires a single booking.");
  return data;
}

async function createHeldCheckout({
  appOrigin,
  accessToken,
  clientId,
  bookingId,
}) {
  const response = await requestJson({
    appOrigin,
    accessToken,
    profileId: clientId,
    path: "/api/stripe/create-checkout-session",
    method: "POST",
    body: { bookingId },
  });

  assert(
    response.payload?.paymentMode === PAYMENT_MODE,
    "KLYX did not create a platform-held Checkout."
  );
  assert(
    typeof response.payload?.url === "string",
    "Stripe Checkout URL is missing."
  );

  return response.payload;
}

async function loadSettlement(admin, bookingId) {
  const { data, error } = await admin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, transfer_group, state, release_attempt_number, last_error_code, last_error_message"
    )
    .eq("booking_id", bookingId)
    .single();

  if (error) {
    throw new Error(`Unable to load booking settlement: ${error.message}`);
  }

  return data;
}

async function createRealHeldCharge({
  stripe,
  settlement,
  bookingId,
  providerId,
}) {
  const intent = await stripe.paymentIntents.create(
    {
      amount: Number(settlement.gross_amount_cents),
      currency: String(settlement.currency).toLowerCase(),
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      transfer_group: settlement.transfer_group,
      metadata: {
        booking_id: bookingId,
        provider_id: providerId,
        payment_mode: PAYMENT_MODE,
        settlement_transfer_group: settlement.transfer_group,
        settlement_provider_profile_id: providerId,
        settlement_provider_stripe_account_id: settlement.stripe_account_id,
        klyx_network_proof: "economic_chain_blocked",
      },
    },
    {
      idempotencyKey: `klyx-economic-chain-payment-${bookingId}`,
    }
  );

  const refreshed = await stripe.paymentIntents.retrieve(intent.id, {
    expand: ["latest_charge"],
  });
  const chargeId = stripeObjectId(refreshed.latest_charge);

  assert(refreshed.livemode === false, "PaymentIntent unexpectedly used LIVE.");
  assert(
    refreshed.status === "succeeded",
    `PaymentIntent did not succeed: ${refreshed.status}.`
  );
  assert(chargeId?.startsWith("ch_"), "Real Stripe charge is missing.");

  return { intent: refreshed, chargeId };
}

async function markHeldPaid({
  appOrigin,
  webhookSecret,
  bookingId,
  providerId,
  settlement,
  intent,
}) {
  const event = {
    id: `evt_test_klyx_economic_chain_${randomUUID().replaceAll("-", "")}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: settlement.stripe_checkout_session_id,
        object: "checkout.session",
        amount_total: settlement.gross_amount_cents,
        currency: String(settlement.currency).toLowerCase(),
        metadata: {
          booking_id: bookingId,
          provider_id: providerId,
          payment_mode: PAYMENT_MODE,
          settlement_transfer_group: settlement.transfer_group,
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

  const response = await postSignedWebhook({
    appOrigin,
    webhookSecret,
    event,
  });

  assert(
    response.payload?.received === true &&
      response.payload?.duplicate === false,
    "KLYX did not accept the signed payment webhook."
  );
}

async function attachStripeTruth({
  admin,
  bookingId,
  checkoutSessionId,
  paymentIntentId,
  chargeId,
}) {
  const { data, error } = await admin.rpc(
    "klyx_attach_booking_settlement_stripe_truth",
    {
      p_booking_id: bookingId,
      p_checkout_session_id: checkoutSessionId,
      p_payment_intent_id: paymentIntentId,
      p_charge_id: chargeId,
    }
  );

  if (error) {
    throw new Error(
      `Unable to attach real Stripe settlement truth: ${error.message}`
    );
  }

  assert(data === true, "Settlement Stripe truth attachment returned false.");
}

function yesterdayIsoDate() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function prepareClientConfirmation(admin, bookingId) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("bookings")
    .update({
      booking_date: yesterdayIsoDate(),
      start_time: "00:00",
      service_status: "in_progress",
      provider_finished_at: now,
      provider_finish_note:
        "Economic-chain Stripe TEST certification completion boundary.",
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", "accepted")
    .eq("payment_status", "paid")
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Unable to prepare client confirmation: ${error?.message ?? "missing booking"}`
    );
  }
}

async function expireCheckout(stripe, sessionId) {
  if (!sessionId) return;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(sessionId);
    }
  } catch {
    // Cleanup best-effort; proof assertions have already completed.
  }
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  assert(
    localSupabase,
    "Economic-chain Stripe proof requires ephemeral local Supabase."
  );

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;
  assert(
    appOrigin === "http://127.0.0.1:3100",
    "Economic-chain proof requires isolated KLYX on 127.0.0.1:3100."
  );

  const stripeSecretKey = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const stripePublishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  );
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");

  assert(
    stripeSecretKey.startsWith("sk_test_"),
    "Economic-chain proof accepts Stripe TEST secret only."
  );
  assert(
    stripePublishableKey.startsWith("pk_test_"),
    "Economic-chain proof accepts Stripe TEST publishable key only."
  );
  assert(
    process.env.KLYX_STRIPE_MODE === "test" &&
      process.env.KLYX_STRIPE_SETTLEMENT_MODE === PAYMENT_MODE &&
      process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY === "true" &&
      process.env.KLYX_LIVE_PAYMENTS_ENABLED === "false",
    "Economic-chain platform-held TEST runtime is not armed safely."
  );

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
  const stripe = new Stripe(stripeSecretKey);

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (
    signInError ||
    !signInData.session?.access_token ||
    !signInData.user
  ) {
    throw new Error(
      "Unable to authenticate economic-chain Stripe proof account."
    );
  }

  let accessToken = signInData.session.access_token;
  const { client, provider, accountId } = await loadProfiles(
    admin,
    signInData.user.id
  );
  const { userServiceId, activityKey } = await loadUserService(
    admin,
    provider.id
  );
  const jurisdictionCode = String(provider.country_code)
    .trim()
    .toUpperCase();

  const handoff = loadProviderFixtureHandoff(provider.id);
  let createdConnectedAccount = Boolean(handoff.created);
  let v2Account = null;
  let stripeAccount = null;
  let bookingId = null;
  let checkoutSessionId = null;
  let paymentIntentId = null;

  try {
    v2Account = await stripe.v2.core.accounts.retrieve(handoff.accountId, {
      include: ["configuration.recipient", "identity", "requirements"],
    });
    assert(
      v2RecipientTransferReady(v2Account),
      "Real Stripe TEST recipient transfer capability is not active."
    );

    stripeAccount = await stripe.accounts.retrieve(handoff.accountId);
    assert(
      v2Account.livemode === false,
      "Accounts v2 recipient unexpectedly uses LIVE mode."
    );
    assert(
      stripeAccount.details_submitted === true &&
        stripeAccount.payouts_enabled === true &&
        stripeAccount.capabilities?.transfers === "active",
      "Stripe TEST connected account is not fully recipient-ready."
    );

    await bindCanonicalStripeAccount({
      admin,
      accountId,
      providerId: provider.id,
      stripeAccount,
    });

    createLifecycleBooking();

    const { data: reauthData, error: reauthError } =
      await userClient.auth.signInWithPassword({ email, password });
    if (reauthError || !reauthData.session?.access_token) {
      throw new Error(
        "Unable to re-authenticate after child golden-path lifecycle."
      );
    }
    accessToken = reauthData.session.access_token;

    const booking = await latestAcceptedUnpaidBooking(
      admin,
      client.id,
      provider.id
    );
    bookingId = booking.id;

    const checkout = await createHeldCheckout({
      appOrigin,
      accessToken,
      clientId: client.id,
      bookingId,
    });
    checkoutSessionId = checkout.sessionId ?? null;

    let settlement = await loadSettlement(admin, bookingId);
    checkoutSessionId =
      checkoutSessionId ?? settlement.stripe_checkout_session_id;

    const { intent, chargeId } = await createRealHeldCharge({
      stripe,
      settlement,
      bookingId,
      providerId: provider.id,
    });
    paymentIntentId = intent.id;

    await markHeldPaid({
      appOrigin,
      webhookSecret,
      bookingId,
      providerId: provider.id,
      settlement,
      intent,
    });

    settlement = await loadSettlement(admin, bookingId);
    assert(
      settlement.state === "held",
      `Settlement did not enter held state: ${settlement.state}.`
    );

    await attachStripeTruth({
      admin,
      bookingId,
      checkoutSessionId: settlement.stripe_checkout_session_id,
      paymentIntentId: intent.id,
      chargeId,
    });

    settlement = await loadSettlement(admin, bookingId);
    const beforeTransfers = await stripe.transfers.list({
      transfer_group: settlement.transfer_group,
      destination: settlement.stripe_account_id,
      limit: 10,
    });
    assert(
      beforeTransfers.data.length === 0,
      "Certification booking already has a provider Transfer."
    );

    await prepareEconomicBaseline({
      admin,
      accountId,
      providerId: provider.id,
      stripeAccount,
      stripeLivemode: v2Account.livemode,
      userServiceId,
      activityKey,
      jurisdictionCode,
      bookingId,
    });

    await prepareClientConfirmation(admin, bookingId);

    const completion = await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/tracking",
      method: "POST",
      body: {
        bookingId,
        action: "client_confirmed",
        note:
          "Stripe TEST is green; KLYX country eligibility intentionally blocks settlement.",
      },
    });

    assert(
      completion.payload?.serviceStatus === "completed",
      "Mission completion did not persist before settlement gate."
    );

    const finalSettlement = await loadSettlement(admin, bookingId);
    assert(
      finalSettlement.state === "review_required",
      `KLYX did not stop settlement: ${finalSettlement.state}.`
    );
    assert(
      finalSettlement.stripe_transfer_id === null,
      "KLYX persisted a Transfer despite blocked eligibility."
    );

    const { data: decisions, error: decisionsError } = await admin
      .from("economic_settlement_eligibility_decisions")
      .select(
        "decision, reason_codes, stripe_account_id, activity_key, jurisdiction_code, evidence_snapshot, evaluated_at"
      )
      .eq("account_id", accountId)
      .eq("subject_type", "booking")
      .eq("subject_id", bookingId)
      .order("evaluated_at", { ascending: false })
      .limit(5);

    if (decisionsError) {
      throw new Error(
        `Unable to load economic eligibility proof: ${decisionsError.message}`
      );
    }

    const blockedDecision = (decisions ?? []).find(
      (decision) => decision.decision === "blocked"
    );
    assert(blockedDecision, "No blocked economic decision was recorded.");
    assert(
      Array.isArray(blockedDecision.reason_codes) &&
        blockedDecision.reason_codes.includes(
          "ECONOMIC_COUNTRY_RESTRICTED"
        ),
      "Blocked decision did not record the KLYX country restriction."
    );
    assert(
      blockedDecision.stripe_account_id === stripeAccount.id,
      "Economic decision did not bind the real Stripe TEST account."
    );
    assert(
      blockedDecision.evidence_snapshot?.stripeProjectionPayoutsEnabled ===
        true,
      "Proof did not record Stripe payouts_enabled=true."
    );
    assert(
      blockedDecision.evidence_snapshot?.stripeTransferCapabilityStatus ===
        "active",
      "Proof did not record active Stripe transfer capability."
    );

    const afterTransfers = await stripe.transfers.list({
      transfer_group: settlement.transfer_group,
      destination: settlement.stripe_account_id,
      limit: 10,
    });

    assert(
      afterTransfers.data.length === 0,
      "Stripe Transfer was created even though KLYX eligibility was blocked."
    );

    const refund = await stripe.refunds.create(
      {
        payment_intent: intent.id,
        amount: Number(settlement.gross_amount_cents),
        metadata: {
          booking_id: bookingId,
          klyx_network_proof: "economic_chain_blocked_cleanup",
        },
      },
      {
        idempotencyKey: `klyx-economic-chain-cleanup-refund-${bookingId}`,
      }
    );

    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(
      PROOF_PATH,
      `${JSON.stringify(
        {
          verified: true,
          stripeTestNetwork: true,
          livemode: false,
          bookingId,
          paymentIntentId: intent.id,
          chargeId,
          refundId: refund.id,
          stripeAccountId: stripeAccount.id,
          stripeRecipientTransferCapability: v2TransferStatus(v2Account),
          stripeDetailsSubmitted: stripeAccount.details_submitted,
          stripePayoutsEnabled: stripeAccount.payouts_enabled,
          stripeTransfersCapability: stripeAccount.capabilities?.transfers,
          klyxDecision: blockedDecision.decision,
          klyxReasonCodes: blockedDecision.reason_codes,
          settlementState: finalSettlement.state,
          stripeTransferCountBefore: beforeTransfers.data.length,
          stripeTransferCountAfter: afterTransfers.data.length,
          invariant:
            "STRIPE_OK_KLYX_BLOCKED_PREVENTS_BENEFICIARY_TRANSFER",
          verifiedAt: new Date().toISOString(),
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    process.stdout.write(
      `${JSON.stringify({
        verified: true,
        stripeOk: true,
        klyxEligibility: "blocked",
        beneficiaryTransferCreated: false,
        settlementState: finalSettlement.state,
        proof: PROOF_PATH,
      })}\n`
    );
  } finally {
    if (checkoutSessionId) {
      await expireCheckout(stripe, checkoutSessionId);
    }

    if (
      stripeAccount &&
      v2Account &&
      createdConnectedAccount
    ) {
      try {
        const closed = await stripe.v2.core.accounts.close(
          stripeAccount.id,
          {
            applied_configurations:
              v2Account.applied_configurations ?? [],
          }
        );
        assert(
          closed.closed === true,
          "Stripe did not confirm closure of TEST connected account."
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Unable to close TEST connected account during cleanup: ${message}`
        );
        process.exitCode = 1;
      }
    }

    await userClient.auth.signOut();

    if (paymentIntentId && bookingId) {
      // Payment/refund truth is intentionally left in Stripe TEST history.
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `KLYX economic-chain Stripe TEST certification failed: ${message}`
  );
  process.exitCode = 1;
});
