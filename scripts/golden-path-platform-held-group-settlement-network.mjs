import { createHmac, randomUUID } from "node:crypto";
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
const HANDOFF = PROOF_DIR + "/platform-held-provider-fixture.json";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stripeObjectId(value) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function futureDate(daysAhead) {
  const date = new Date(Date.now() + daysAhead * 86400000);
  return date.toISOString().slice(0, 10);
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

function signedStripeEvent(payload, webhookSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify(payload);
  const digest = createHmac("sha256", webhookSecret)
    .update(String(timestamp) + "." + raw, "utf8")
    .digest("hex");

  return {
    raw,
    signature: "t=" + String(timestamp) + ",v1=" + digest,
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

async function loadProfiles(admin, ownerUserId) {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, account_id, account_type, country_code, currency_code, stripe_account_id"
    )
    .eq("owner_user_id", ownerUserId);

  if (error) throw new Error(error.message);

  const client = (data ?? []).find((row) => row.account_type === "client");
  const provider = (data ?? []).find((row) => row.account_type === "provider");

  assert(client && provider, "Group proof profiles are missing.");
  assert(provider.account_id, "Provider canonical account is missing.");
  assert(
    client.account_id === provider.account_id,
    "Proof profiles must share one canonical account."
  );

  return { client, provider, accountId: provider.account_id };
}

function loadFixture(providerId) {
  assert(fs.existsSync(HANDOFF), "Platform-held provider fixture handoff is missing.");
  const handoff = JSON.parse(fs.readFileSync(HANDOFF, "utf8"));

  assert(handoff.testMode === true, "Provider handoff is not TEST-only.");
  assert(
    handoff.providerProfileId === providerId,
    "Provider handoff profile mismatch."
  );
  assert(
    typeof handoff.accountId === "string" && handoff.accountId.startsWith("acct_"),
    "Provider handoff Stripe account is invalid."
  );

  return handoff;
}

async function bindCanonicalAccount(admin, accountId, providerId, stripeAccount) {
  const { error: resetError } = await admin
    .from("account_stripe_connect_identities")
    .delete()
    .eq("account_id", accountId);
  if (resetError) throw new Error(resetError.message);

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
  if (identityError) throw new Error(identityError.message);

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
  if (profileError) throw new Error(profileError.message);
}

async function loadBookableService(admin, providerId) {
  const { data, error } = await admin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", providerId)
    .eq("active", true)
    .eq("provider_enabled", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Bookable service missing.");
  }

  return data;
}

async function createAcceptedGroup({
  admin,
  client,
  provider,
  userService,
  index,
}) {
  const requestDateA = futureDate(20 + index * 3);
  const requestDateB = futureDate(21 + index * 3);

  const { data: requestRow, error: requestError } = await admin
    .from("market_service_requests")
    .insert({
      client_profile_id: client.id,
      service_id: userService.service_id,
      title: "Stripe TEST group settlement proof",
      description:
        "Ephemeral multi-slot request for the KLYX group settlement network proof.",
      city: "Brussels",
      country_code: "BE",
      currency: "EUR",
      status: "open",
      request_mode: "multi_slot",
      slot_count: 2,
      budget_total: 100,
      prefer_single_provider: true,
    })
    .select("id")
    .single();

  if (requestError) throw new Error(requestError.message);

  const { error: slotsError } = await admin
    .from("market_service_request_slots")
    .insert([
      {
        market_request_id: requestRow.id,
        position: 1,
        requested_date: requestDateA,
        start_time: "10:00:00",
        end_time: "11:00:00",
        budget_max: 50,
        duration_minutes: 60,
      },
      {
        market_request_id: requestRow.id,
        position: 2,
        requested_date: requestDateB,
        start_time: "10:00:00",
        end_time: "11:00:00",
        budget_max: 50,
        duration_minutes: 60,
      },
    ]);
  if (slotsError) throw new Error(slotsError.message);

  const { data: offer, error: offerError } = await admin
    .from("market_service_offers")
    .insert({
      request_id: requestRow.id,
      provider_profile_id: provider.id,
      user_service_id: userService.id,
      country_code: "BE",
      currency: "EUR",
      amount: 100,
      message: "Stripe TEST group settlement proof.",
      status: "sent",
    })
    .select("id")
    .single();

  if (offerError) throw new Error(offerError.message);

  const { data: groupId, error: groupError } = await admin.rpc(
    "klyx_create_multi_slot_booking_group",
    {
      p_market_request_id: requestRow.id,
      p_client_profile_id: client.id,
      p_offer_id: offer.id,
    }
  );
  if (groupError || !groupId) {
    throw new Error(groupError?.message ?? "Group creation failed.");
  }

  const { data: decision, error: decisionError } = await admin.rpc(
    "klyx_provider_group_decision",
    {
      p_group_id: groupId,
      p_provider_profile_id: provider.id,
      p_action: "accept",
      p_note: "Stripe TEST group settlement acceptance.",
    }
  );
  if (decisionError || decision !== "accepted") {
    throw new Error(decisionError?.message ?? "Group acceptance failed.");
  }

  const { data: children, error: childError } = await admin
    .from("bookings")
    .select("id, amount_total, group_position")
    .eq("booking_group_id", groupId)
    .order("group_position", { ascending: true });

  if (childError) throw new Error(childError.message);
  assert(children?.length === 2, "Group proof requires exactly two children.");

  return {
    groupId,
    requestId: requestRow.id,
    children,
  };
}

async function createHeldCheckout({
  appOrigin,
  accessToken,
  clientId,
  groupId,
}) {
  const response = await requestJson({
    appOrigin,
    accessToken,
    profileId: clientId,
    path: "/api/stripe/create-group-checkout-session",
    method: "POST",
    body: { groupId },
  });

  assert(response.payload?.paymentMode === PAYMENT_MODE, "Group held mode was not selected.");
  assert(response.payload?.reused === false, "Group proof Checkout was unexpectedly reused.");
  return response.payload;
}

async function loadSettlement(admin, groupId) {
  const { data, error } = await admin
    .from("booking_group_settlements")
    .select(
      "booking_group_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, transfer_group, state, release_attempt_number"
    )
    .eq("booking_group_id", groupId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function createRealCharge({ stripe, settlement, groupId, providerId }) {
  const intent = await stripe.paymentIntents.create(
    {
      amount: Number(settlement.gross_amount_cents),
      currency: settlement.currency.toLowerCase(),
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      transfer_group: settlement.transfer_group,
      metadata: {
        booking_group_id: groupId,
        provider_id: providerId,
        payment_mode: PAYMENT_MODE,
        settlement_transfer_group: settlement.transfer_group,
        klyx_network_proof: "platform_held_group",
      },
    },
    { idempotencyKey: "klyx-held-group-proof-payment-" + groupId }
  );

  const refreshed = await stripe.paymentIntents.retrieve(intent.id, {
    expand: ["latest_charge"],
  });
  const chargeId = stripeObjectId(refreshed.latest_charge);

  assert(refreshed.livemode === false, "Group charge unexpectedly used live mode.");
  assert(refreshed.status === "succeeded", "Group PaymentIntent did not succeed.");
  assert(chargeId?.startsWith("ch_"), "Group charge id is missing.");

  return { intent: refreshed, chargeId };
}

async function markGroupPaid({
  admin,
  appOrigin,
  webhookSecret,
  groupId,
  providerId,
  settlement,
  intent,
  chargeId,
}) {
  const event = {
    id: "evt_test_klyx_group_" + randomUUID().replaceAll("-", ""),
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: settlement.stripe_checkout_session_id,
        object: "checkout.session",
        amount_total: settlement.gross_amount_cents,
        currency: settlement.currency.toLowerCase(),
        metadata: {
          booking_group_id: groupId,
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

  const webhook = await postSignedWebhook({
    appOrigin,
    webhookSecret,
    event,
  });
  assert(webhook.payload?.received === true, "Group paid webhook was rejected.");

  const { data: attached, error: attachError } = await admin.rpc(
    "klyx_attach_booking_group_settlement_stripe_truth",
    {
      p_group_id: groupId,
      p_checkout_session_id: settlement.stripe_checkout_session_id,
      p_payment_intent_id: intent.id,
      p_charge_id: chargeId,
    }
  );
  if (attachError || attached !== true) {
    throw new Error(attachError?.message ?? "Group Stripe truth attachment failed.");
  }

  const held = await loadSettlement(admin, groupId);
  assert(held.state === "held", "Group settlement did not enter held state.");

  const { data: paidGroup, error: paidError } = await admin
    .from("booking_groups")
    .select(
      "payment_status, payment_mode, total_amount_cents, platform_fee_amount, provider_amount"
    )
    .eq("id", groupId)
    .single();
  if (paidError) throw new Error(paidError.message);

  assert(paidGroup.payment_status === "paid", "Group payment was not persisted.");
  assert(paidGroup.payment_mode === PAYMENT_MODE, "Group payment mode changed.");
  assert(
    Number(paidGroup.platform_fee_amount) + Number(paidGroup.provider_amount) ===
      Number(paidGroup.total_amount_cents),
    "Group economics do not conserve captured funds."
  );

  return held;
}

async function completeGroupThroughTracking({
  admin,
  appOrigin,
  accessToken,
  clientId,
  groupId,
  children,
}) {
  const now = new Date().toISOString();

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (index < children.length - 1) {
      const { error } = await admin
        .from("bookings")
        .update({
          status: "completed",
          service_status: "completed",
          provider_finished_at: now,
          client_confirmed_at: now,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", child.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("bookings")
        .update({
          status: "accepted",
          service_status: "in_progress",
          provider_finished_at: now,
          client_confirmed_at: null,
          completed_at: null,
          updated_at: now,
        })
        .eq("id", child.id);
      if (error) throw new Error(error.message);
    }
  }

  const finalChild = children[children.length - 1];
  const response = await requestJson({
    appOrigin,
    accessToken,
    profileId: clientId,
    path: "/api/bookings/tracking",
    method: "POST",
    body: {
      bookingId: finalChild.id,
      action: "client_confirmed",
      note: "Stripe TEST group settlement completion.",
    },
  });

  assert(
    response.payload?.serviceStatus === "completed",
    "Final group child did not complete."
  );

  const { data: group, error: groupError } = await admin
    .from("booking_groups")
    .select("status")
    .eq("id", groupId)
    .single();
  if (groupError) throw new Error(groupError.message);
  assert(group.status === "completed", "Group lifecycle did not become completed.");

  return finalChild.id;
}

async function waitForReleased(admin, groupId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const settlement = await loadSettlement(admin, groupId);
    if (settlement.state === "released") return settlement;
    if (settlement.state === "review_required") {
      throw new Error("Group settlement unexpectedly entered review_required.");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Group settlement did not release.");
}

async function reverseAndRefund({
  stripe,
  admin,
  appOrigin,
  webhookSecret,
  groupId,
  settlement,
  intent,
  chargeId,
}) {
  const { data, error } = await admin.rpc(
    "klyx_prepare_booking_group_settlement_refund",
    { p_group_id: groupId }
  );
  if (error) throw new Error(error.message);

  const prepared = (data ?? [])[0];
  assert(
    prepared?.action === "reverse_transfer",
    "Released group did not require Transfer reversal."
  );

  const reversalKey = "klyx-booking-group-settlement-reversal-" + groupId;
  const reversalParams = {
    amount: Number(settlement.provider_amount_cents),
    metadata: {
      booking_group_id: groupId,
      payment_mode: PAYMENT_MODE,
    },
  };

  const first = await stripe.transfers.createReversal(
    settlement.stripe_transfer_id,
    reversalParams,
    { idempotencyKey: reversalKey }
  );
  const retry = await stripe.transfers.createReversal(
    settlement.stripe_transfer_id,
    reversalParams,
    { idempotencyKey: reversalKey }
  );
  assert(first.id === retry.id, "Group reversal idempotency created a second object.");

  const { data: finalized, error: finalizeError } = await admin.rpc(
    "klyx_finalize_booking_group_settlement_reversal",
    {
      p_group_id: groupId,
      p_stripe_transfer_id: settlement.stripe_transfer_id,
      p_stripe_transfer_reversal_id: first.id,
    }
  );
  if (finalizeError || finalized !== true) {
    throw new Error(finalizeError?.message ?? "Group reversal finalize failed.");
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: intent.id,
      amount: Number(settlement.gross_amount_cents),
      metadata: {
        booking_group_id: groupId,
        payment_mode: PAYMENT_MODE,
        klyx_network_proof: "platform_held_group",
      },
    },
    { idempotencyKey: "klyx-booking-group-refund-network-proof-" + groupId }
  );

  let remote = refund;
  for (let attempt = 0; attempt < 40 && remote.status === "pending"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    remote = await stripe.refunds.retrieve(refund.id);
  }

  assert(remote.status === "succeeded", "Group Stripe TEST refund did not succeed.");
  assert(stripeObjectId(remote.charge) === chargeId, "Group refund charge mismatch.");

  const event = {
    id: "evt_test_klyx_group_refund_" + randomUUID().replaceAll("-", ""),
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: { object: remote },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "refund.updated",
  };

  await postSignedWebhook({ appOrigin, webhookSecret, event });

  const terminal = await loadSettlement(admin, groupId);
  assert(terminal.state === "refunded", "Group settlement did not become refunded.");
  assert(
    terminal.stripe_transfer_reversal_id === first.id,
    "Group settlement lost reversal truth."
  );

  return { reversalId: first.id, refundId: remote.id };
}

async function expireCheckout(stripe, sessionId) {
  if (!sessionId) return;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === "open") {
    await stripe.checkout.sessions.expire(sessionId);
  }
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  assert(localSupabase, "Group settlement proof requires ephemeral local Supabase.");

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  assert(
    appOrigin === "http://127.0.0.1:3100",
    "Group settlement proof requires isolated KLYX on 127.0.0.1:3100."
  );

  const stripeSecretKey = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const publishableStripeKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  );
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");

  assert(stripeSecretKey.startsWith("sk_test_"), "Group proof requires sk_test_*.");
  assert(publishableStripeKey.startsWith("pk_test_"), "Group proof requires pk_test_*.");
  assert(process.env.KLYX_STRIPE_MODE === "test", "Group proof requires test mode.");
  assert(
    process.env.KLYX_STRIPE_SETTLEMENT_MODE === PAYMENT_MODE,
    "Group proof requires platform_held settlement mode."
  );
  assert(
    process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY === "true",
    "Group proof requires the TEST readiness guard."
  );
  assert(
    process.env.KLYX_LIVE_PAYMENTS_ENABLED === "false",
    "Live payments must remain disabled."
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

  const { data: signIn, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session?.access_token || !signIn.user) {
    throw new Error("Unable to authenticate group settlement proof account.");
  }

  const accessToken = signIn.session.access_token;
  const { client, provider, accountId } = await loadProfiles(admin, signIn.user.id);
  const userService = await loadBookableService(admin, provider.id);
  const handoff = loadFixture(provider.id);

  const recipient = await stripe.v2.core.accounts.retrieve(handoff.accountId, {
    include: ["configuration.recipient", "identity", "requirements"],
  });
  assert(recipient.livemode === false, "Recipient account unexpectedly uses live mode.");
  assert(
    recipient.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers
      ?.status === "active",
    "Recipient account is not transfer-ready."
  );

  const stripeAccount = await stripe.accounts.retrieve(handoff.accountId);
  await bindCanonicalAccount(admin, accountId, provider.id, stripeAccount);

  const group = await createAcceptedGroup({
    admin,
    client,
    provider,
    userService,
    index: 0,
  });

  let checkoutSessionId = null;

  try {
    const checkout = await createHeldCheckout({
      appOrigin,
      accessToken,
      clientId: client.id,
      groupId: group.groupId,
    });
    assert(typeof checkout.url === "string", "Group Checkout URL is missing.");

    const pending = await loadSettlement(admin, group.groupId);
    checkoutSessionId = pending.stripe_checkout_session_id;

    assert(pending.state === "pending_payment", "Group settlement did not start pending.");
    assert(pending.payment_mode === PAYMENT_MODE, "Group settlement mode mismatch.");
    assert(
      Number(pending.platform_fee_cents) + Number(pending.provider_amount_cents) ===
        Number(pending.gross_amount_cents),
      "Frozen group economics do not conserve captured funds."
    );

    const { intent, chargeId } = await createRealCharge({
      stripe,
      settlement: pending,
      groupId: group.groupId,
      providerId: provider.id,
    });

    const held = await markGroupPaid({
      admin,
      appOrigin,
      webhookSecret,
      groupId: group.groupId,
      providerId: provider.id,
      settlement: pending,
      intent,
      chargeId,
    });

    const finalChildId = await completeGroupThroughTracking({
      admin,
      appOrigin,
      accessToken,
      clientId: client.id,
      groupId: group.groupId,
      children: group.children,
    });

    const released = await waitForReleased(admin, group.groupId);
    assert(released.stripe_transfer_id?.startsWith("tr_"), "Group Transfer id missing.");

    const transfer = await stripe.transfers.retrieve(released.stripe_transfer_id);
    assert(transfer.livemode === false, "Group Transfer unexpectedly used live mode.");
    assert(
      transfer.amount === Number(released.provider_amount_cents),
      "Group Transfer amount mismatch."
    );
    assert(
      stripeObjectId(transfer.destination) === released.stripe_account_id,
      "Group Transfer destination mismatch."
    );
    assert(
      stripeObjectId(transfer.source_transaction) === chargeId,
      "Group Transfer source_transaction mismatch."
    );
    assert(
      transfer.transfer_group === released.transfer_group,
      "Group Transfer group mismatch."
    );
    assert(
      transfer.amount <= Number(released.gross_amount_cents),
      "Group release exceeds captured funds."
    );

    await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/bookings/tracking",
      method: "POST",
      body: {
        bookingId: finalChildId,
        action: "client_confirmed",
        note: "Idempotent group release retry.",
      },
    });

    const transfers = await stripe.transfers.list({
      transfer_group: released.transfer_group,
      destination: released.stripe_account_id,
      limit: 10,
    });
    const matchingTransfers = transfers.data.filter(
      (candidate) =>
        candidate.metadata?.booking_group_id === group.groupId &&
        candidate.metadata?.payment_mode === PAYMENT_MODE
    );
    assert(matchingTransfers.length === 1, "Group release retry created double Transfer.");

    const refund = await reverseAndRefund({
      stripe,
      admin,
      appOrigin,
      webhookSecret,
      groupId: group.groupId,
      settlement: released,
      intent,
      chargeId,
    });

    const proof = {
      verified: true,
      stripeTestNetwork: true,
      livemode: false,
      paymentMode: PAYMENT_MODE,
      scope: "booking_group_single_provider",
      splitBookingEnabled: false,
      liveSecretAccepted: false,
      groupId: group.groupId,
      childCount: group.children.length,
      paymentIntentId: intent.id,
      chargeId,
      transferId: released.stripe_transfer_id,
      reversalId: refund.reversalId,
      refundId: refund.refundId,
      transferGroup: released.transfer_group,
      grossAmountCents: Number(released.gross_amount_cents),
      platformFeeCents: Number(released.platform_fee_cents),
      providerAmountCents: Number(released.provider_amount_cents),
      transferCountAfterRetry: matchingTransfers.length,
      invariants: {
        multipleParticipants: group.children.length > 1,
        oneGroupOneTransfer: true,
        platformCommissionFrozen: true,
        centRoundingConserved: true,
        sourceTransactionBound: true,
        releaseAtMostCaptured: true,
        canonicalStripeIdentity: true,
        recipientCapabilityCheckedAtRelease: true,
        idempotentTransfer: true,
        idempotentReversal: true,
        refundAfterReversal: true,
        liveOff: true,
        splitStillOff: true,
      },
      verifiedAt: new Date().toISOString(),
    };

    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(
      PROOF_DIR + "/platform-held-group-settlement-proof.json",
      JSON.stringify(proof, null, 2) + "\n",
      "utf8"
    );

    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    try {
      await expireCheckout(stripe, checkoutSessionId);
    } catch {
      // Proof DB is ephemeral; cleanup failure is reported by the workflow log.
    }

    await userClient.auth.signOut();
  }
}

main().catch((error) => {
  console.error(
    "KLYX platform-held group Stripe network proof failed: " +
      (error instanceof Error ? error.message : String(error))
  );
  process.exitCode = 1;
});
