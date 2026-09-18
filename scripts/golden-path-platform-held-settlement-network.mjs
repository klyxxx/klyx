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
const PROVIDER_FIXTURE_HANDOFF = `${PROOF_DIR}/platform-held-provider-fixture.json`;

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
      throw new Error(`${method} ${path} returned non-JSON status ${response.status}.`);
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";
    throw new Error(`${method} ${path} returned ${response.status}: ${safeMessage}`);
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

function v2TransferStatus(account) {
  return (
    account?.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? null
  );
}

function v2RecipientTransferReady(account) {
  return (
    account?.livemode === false &&
    account?.identity?.country === "BE" &&
    account?.applied_configurations?.includes("recipient") === true &&
    account?.configuration?.recipient?.applied === true &&
    v2TransferStatus(account) === "active"
  );
}

async function loadProfiles(admin, ownerUserId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, account_id, account_type, country_code, currency_code, stripe_account_id")
    .eq("owner_user_id", ownerUserId);

  if (error) throw new Error(`Unable to load held-settlement profiles: ${error.message}`);

  const client = (data ?? []).find((profile) => profile.account_type === "client");
  const provider = (data ?? []).find((profile) => profile.account_type === "provider");

  assert(client && provider, "Held-settlement client/provider profiles are missing.");
  assert(provider.account_id, "Provider profile is missing its canonical KLYX account.");
  assert(client.account_id === provider.account_id, "Golden-path profiles must share one canonical KLYX account.");
  assert(client.country_code === "BE" && provider.country_code === "BE", "Held proof requires BE profiles.");
  assert(client.currency_code === "EUR" && provider.currency_code === "EUR", "Held proof requires EUR profiles.");

  return { client, provider, accountId: provider.account_id };
}

async function latestAcceptedUnpaidBooking(admin, clientId, providerId) {
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, booking_group_id, status, payment_status, service_status, amount_total, currency, payment_mode, stripe_checkout_session_id, stripe_payment_intent_id"
    )
    .eq("parent_id", clientId)
    .eq("provider_id", providerId)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Unable to locate accepted unpaid held-proof booking: ${error?.message ?? "missing booking"}`);
  }

  assert(data.booking_group_id === null, "Held proof booking must not belong to a group.");

  const { data: splitRows, error: splitError } = await admin
    .from("split_booking_payment_units")
    .select("id")
    .filter("booking_ids", "cs", JSON.stringify([data.id]))
    .limit(1);

  if (splitError) throw new Error(`Unable to verify split isolation: ${splitError.message}`);
  assert((splitRows ?? []).length === 0, "Held proof booking must not belong to a split payment unit.");

  return data;
}

function loadPlatformHeldFixtureHandoff(providerId) {
  if (!fs.existsSync(PROVIDER_FIXTURE_HANDOFF)) {
    throw new Error("Platform-held provider fixture handoff is missing.");
  }

  let handoff;
  try {
    handoff = JSON.parse(fs.readFileSync(PROVIDER_FIXTURE_HANDOFF, "utf8"));
  } catch {
    throw new Error("Platform-held provider fixture handoff is invalid JSON.");
  }

  assert(handoff?.testMode === true, "Platform-held provider fixture handoff is not TEST-only.");
  assert(
    handoff?.providerProfileId === providerId,
    "Platform-held provider fixture handoff provider mismatch."
  );
  assert(
    typeof handoff?.accountId === "string" && handoff.accountId.startsWith("acct_"),
    "Platform-held provider fixture handoff account id is invalid."
  );
  assert(
    typeof handoff?.created === "boolean",
    "Platform-held provider fixture handoff creation flag is invalid."
  );

  return handoff;
}

async function provisionConnectedAccount({ stripe, providerId }) {
  const handoff = loadPlatformHeldFixtureHandoff(providerId);
  const v2Account = await stripe.v2.core.accounts.retrieve(handoff.accountId, {
    include: ["configuration.recipient", "identity", "requirements"],
  });

  assert(
    v2RecipientTransferReady(v2Account),
    "Platform-held provider fixture handoff account is not recipient-transfer-ready."
  );

  const legacyAccount = await stripe.accounts.retrieve(handoff.accountId);
  assert(
    v2Account.livemode === false,
    "Platform-held provider fixture Accounts v2 object unexpectedly used live mode."
  );
  assert(
    legacyAccount.id === handoff.accountId,
    "Platform-held provider fixture v1 projection id mismatch."
  );
  assert(legacyAccount.country === "BE", "Platform-held provider fixture country mismatch.");
  assert(
    legacyAccount.metadata?.klyx_platform_held_network_fixture === "true",
    "Platform-held provider fixture metadata marker is missing."
  );
  assert(
    legacyAccount.metadata?.klyx_provider_profile_id === providerId,
    "Platform-held provider fixture metadata provider mismatch."
  );

  return {
    account: legacyAccount,
    v2Account,
    createdForProof: handoff.created,
  };
}

async function bindCanonicalAccount(admin, accountId, stripeAccount) {
  const { error: reviewsError } = await admin
    .from("stripe_connect_identity_reviews")
    .delete()
    .eq("account_id", accountId);
  if (reviewsError) throw new Error(`Unable to clear local Stripe review fixture: ${reviewsError.message}`);

  const { error: profilesError } = await admin
    .from("profiles")
    .update({
      stripe_account_id: null,
      stripe_onboarding_complete: stripeAccount.details_submitted,
      stripe_charges_enabled: stripeAccount.charges_enabled,
      stripe_payouts_enabled: stripeAccount.payouts_enabled,
    })
    .eq("account_id", accountId);
  if (profilesError) throw new Error(`Unable to reset legacy profile Stripe fixture: ${profilesError.message}`);

  const { error: accountResetError } = await admin
    .from("accounts")
    .update({
      stripe_account_id: null,
      stripe_connect_state: "unlinked",
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_status_updated_at: null,
    })
    .eq("id", accountId);
  if (accountResetError) throw new Error(`Unable to reset canonical Stripe fixture: ${accountResetError.message}`);

  const { data: bindData, error: bindError } = await admin.rpc(
    "klyx_bind_account_stripe_connect",
    {
      p_account_id: accountId,
      p_stripe_account_id: stripeAccount.id,
    }
  );
  if (bindError) throw new Error(`Unable to bind canonical Stripe account: ${bindError.message}`);
  if (bindData !== null && bindData !== undefined && bindData !== "linked") {
    throw new Error(`Unexpected canonical Stripe binding result: ${String(bindData)}`);
  }

  const { error: statusError } = await admin
    .from("accounts")
    .update({
      stripe_onboarding_complete: stripeAccount.details_submitted,
      stripe_charges_enabled: stripeAccount.charges_enabled,
      stripe_payouts_enabled: stripeAccount.payouts_enabled,
      stripe_status_updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("stripe_account_id", stripeAccount.id)
    .eq("stripe_connect_state", "linked");
  if (statusError) throw new Error(`Unable to persist canonical Stripe status: ${statusError.message}`);

  const { data: canonical, error: canonicalError } = await admin
    .from("accounts")
    .select("stripe_account_id, stripe_connect_state")
    .eq("id", accountId)
    .single();
  if (canonicalError) throw new Error(`Unable to verify canonical Stripe binding: ${canonicalError.message}`);
  assert(canonical.stripe_account_id === stripeAccount.id, "Canonical account did not retain the Stripe account id.");
  assert(canonical.stripe_connect_state === "linked", "Canonical Stripe account is not linked.");
}

async function createHeldCheckout({ appOrigin, accessToken, clientId, bookingId }) {
  const response = await requestJson({
    appOrigin,
    accessToken,
    profileId: clientId,
    path: "/api/stripe/create-checkout-session",
    method: "POST",
    body: { bookingId },
  });

  assert(response.payload?.reused === false, "Held Checkout must be newly created for the proof booking.");
  assert(response.payload?.paymentMode === PAYMENT_MODE, "KLYX did not activate platform_held Checkout.");
  assert(typeof response.payload?.url === "string", "Held Checkout URL is missing.");

  const url = new URL(response.payload.url);
  assert(url.protocol === "https:" && url.hostname.endsWith("stripe.com"), "Held Checkout URL is not Stripe HTTPS.");
  return response.payload;
}

async function loadSettlement(admin, bookingId) {
  const { data, error } = await admin
    .from("booking_settlements")
    .select(
      "booking_id, provider_profile_id, stripe_account_id, payment_mode, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, transfer_group, state, release_attempt_number, release_claim_token, released_at, transfer_reversed_at, refunded_at"
    )
    .eq("booking_id", bookingId)
    .single();

  if (error) throw new Error(`Unable to load booking settlement: ${error.message}`);
  return data;
}

async function createRealHeldCharge({ stripe, settlement, bookingId, providerId }) {
  const intent = await stripe.paymentIntents.create(
    {
      amount: Number(settlement.gross_amount_cents),
      currency: settlement.currency.toLowerCase(),
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
        klyx_network_proof: "platform_held",
      },
    },
    { idempotencyKey: `klyx-held-proof-payment-${bookingId}` }
  );

  const refreshed = await stripe.paymentIntents.retrieve(intent.id, {
    expand: ["latest_charge"],
  });
  const chargeId = stripeObjectId(refreshed.latest_charge);

  assert(refreshed.livemode === false, "Held proof PaymentIntent unexpectedly used live mode.");
  assert(refreshed.status === "succeeded", `Held proof PaymentIntent did not succeed: ${refreshed.status}.`);
  assert(chargeId?.startsWith("ch_"), "Held proof did not create a real Stripe charge.");
  assert(refreshed.transfer_group === settlement.transfer_group, "PaymentIntent transfer_group mismatch.");

  const charge = await stripe.charges.retrieve(chargeId);
  assert(charge.livemode === false, "Held proof charge unexpectedly used live mode.");
  assert(stripeObjectId(charge.payment_intent) === refreshed.id, "Charge is not attached to the held PaymentIntent.");

  return { intent: refreshed, charge };
}

async function markHeldPaid({
  appOrigin,
  webhookSecret,
  bookingId,
  providerId,
  settlement,
  intent,
}) {
  const nonce = randomUUID().replaceAll("-", "");
  const event = {
    id: `evt_test_klyx_held_${nonce}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: settlement.stripe_checkout_session_id,
        object: "checkout.session",
        amount_total: settlement.gross_amount_cents,
        currency: settlement.currency.toLowerCase(),
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

  const webhook = await postSignedWebhook({ appOrigin, webhookSecret, event });
  assert(webhook.payload?.received === true, "KLYX did not accept the held payment webhook.");
  assert(webhook.payload?.duplicate === false, "Held payment webhook was unexpectedly marked duplicate.");
}

async function assertBookingHeld(admin, bookingId, intentId, chargeId) {
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, status, payment_status, payment_mode, booking_group_id, stripe_payment_intent_id")
    .eq("id", bookingId)
    .single();
  if (bookingError) throw new Error(`Unable to verify held booking: ${bookingError.message}`);

  assert(booking.status === "accepted", "Paid held booking must remain accepted before completion.");
  assert(booking.payment_status === "paid", "Held booking payment was not persisted as paid.");
  assert(booking.payment_mode === PAYMENT_MODE, "Held booking payment mode changed unexpectedly.");
  assert(booking.booking_group_id === null, "Held booking unexpectedly became grouped.");
  assert(booking.stripe_payment_intent_id === intentId, "Held booking PaymentIntent truth mismatch.");

  const settlement = await loadSettlement(admin, bookingId);
  assert(settlement.state === "held", `Settlement did not enter held state: ${settlement.state}.`);
  assert(settlement.stripe_payment_intent_id === intentId, "Settlement PaymentIntent truth mismatch.");
  assert(settlement.stripe_charge_id === chargeId, "Settlement charge truth mismatch.");
  return settlement;
}

async function expireCheckout(stripe, sessionId) {
  if (!sessionId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(sessionId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to expire held proof Checkout ${sessionId}: ${message}`);
    process.exitCode = 1;
  }
}

async function runRefundBeforeReleaseScenario({
  stripe,
  admin,
  appOrigin,
  accessToken,
  webhookSecret,
  client,
  provider,
}) {
  const booking = await latestAcceptedUnpaidBooking(admin, client.id, provider.id);
  await createHeldCheckout({ appOrigin, accessToken, clientId: client.id, bookingId: booking.id });

  const pendingSettlement = await loadSettlement(admin, booking.id);
  assert(pendingSettlement.state === "pending_payment", "Held settlement must start pending_payment.");
  assert(pendingSettlement.payment_mode === PAYMENT_MODE, "Settlement payment mode must be platform_held.");
  assert(pendingSettlement.stripe_account_id?.startsWith("acct_"), "Settlement must freeze a connected account id.");

  const { intent, charge } = await createRealHeldCharge({
    stripe,
    settlement: pendingSettlement,
    bookingId: booking.id,
    providerId: provider.id,
  });
  await markHeldPaid({
    appOrigin,
    webhookSecret,
    bookingId: booking.id,
    providerId: provider.id,
    settlement: pendingSettlement,
    intent,
  });

  const held = await assertBookingHeld(admin, booking.id, intent.id, charge.id);

  const beforeTransfers = await stripe.transfers.list({
    transfer_group: held.transfer_group,
    destination: held.stripe_account_id,
    limit: 10,
  });
  assert(beforeTransfers.data.length === 0, "Refund-before-release scenario must have no provider Transfer.");

  const cancellation = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/status",
    method: "POST",
    body: {
      bookingId: booking.id,
      status: "cancelled",
      note: "Platform-held Stripe TEST proof: refund before release.",
    },
  });
  assert(cancellation.payload?.status === "cancelled", "Refund-before-release cancellation did not complete.");
  assert(cancellation.payload?.refunded === true, "Refund-before-release did not create the customer refund.");

  const { data: refundedBooking, error: refundedBookingError } = await admin
    .from("bookings")
    .select("payment_status, refund_status, stripe_refund_id, refunded_amount_cents")
    .eq("id", booking.id)
    .single();
  if (refundedBookingError) throw new Error(`Unable to verify pre-release refund: ${refundedBookingError.message}`);

  assert(refundedBooking.payment_status === "refunded", "Pre-release booking is not terminal refunded.");
  assert(refundedBooking.refund_status === "succeeded", "Pre-release refund did not succeed.");
  assert(refundedBooking.stripe_refund_id?.startsWith("re_"), "Pre-release Stripe refund id is missing.");

  const remoteRefund = await stripe.refunds.retrieve(refundedBooking.stripe_refund_id);
  assert(remoteRefund.livemode === false && remoteRefund.status === "succeeded", "Remote pre-release refund is not a succeeded TEST refund.");
  assert(stripeObjectId(remoteRefund.payment_intent) === intent.id, "Pre-release refund PaymentIntent mismatch.");

  const terminal = await loadSettlement(admin, booking.id);
  assert(terminal.state === "refunded", `Pre-release settlement did not become refunded: ${terminal.state}.`);
  assert(terminal.stripe_transfer_id === null, "Pre-release refund must not create a provider Transfer.");
  assert(terminal.stripe_transfer_reversal_id === null, "Pre-release refund must not create a reversal.");

  const afterTransfers = await stripe.transfers.list({
    transfer_group: held.transfer_group,
    destination: held.stripe_account_id,
    limit: 10,
  });
  assert(afterTransfers.data.length === 0, "Pre-release refund created an unexpected provider Transfer.");

  await expireCheckout(stripe, held.stripe_checkout_session_id);

  return {
    bookingId: booking.id,
    paymentIntentId: intent.id,
    chargeId: charge.id,
    refundId: remoteRefund.id,
    transferGroup: held.transfer_group,
    transferCount: 0,
    settlementState: terminal.state,
  };
}

function createSecondLifecycleBooking() {
  const child = spawnSync(process.execPath, ["scripts/golden-path-client-lifecycle.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (child.status !== 0) {
    throw new Error(`Second golden-path lifecycle booking failed with exit code ${child.status}.`);
  }
}

async function markBookingCompletedForSettlement(admin, bookingId) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("bookings")
    .update({
      status: "completed",
      service_status: "completed",
      provider_finished_at: now,
      client_confirmed_at: now,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", "accepted")
    .eq("payment_status", "paid")
    .select("id, status, service_status, payment_status")
    .single();

  if (error) throw new Error(`Unable to complete held proof booking: ${error.message}`);
  assert(data.status === "completed" && data.service_status === "completed", "Held proof booking did not become completed.");
}

async function insertSettlementRiskAllow(admin, accountId, bookingId) {
  const now = new Date().toISOString();
  const { error } = await admin.from("transaction_risk_decisions").insert({
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
    deduplication_key: `network-proof:settlement-release:${bookingId}:${randomUUID()}`,
  });
  if (error) throw new Error(`Unable to persist settlement_release allow decision: ${error.message}`);
}

async function claimRelease(admin, bookingId, claimToken) {
  const { data, error } = await admin.rpc("klyx_claim_booking_settlement_release", {
    p_booking_id: bookingId,
    p_claim_token: claimToken,
  });
  if (error) throw new Error(`Settlement release claim failed: ${error.message}`);
  const row = (data ?? [])[0];
  assert(row, "Settlement release claim returned no row.");
  return row;
}

async function runReleaseRetryReversalScenario({
  stripe,
  admin,
  appOrigin,
  accessToken,
  webhookSecret,
  client,
  provider,
  accountId,
}) {
  createSecondLifecycleBooking();
  const booking = await latestAcceptedUnpaidBooking(admin, client.id, provider.id);
  await createHeldCheckout({ appOrigin, accessToken, clientId: client.id, bookingId: booking.id });

  const pendingSettlement = await loadSettlement(admin, booking.id);
  const { intent, charge } = await createRealHeldCharge({
    stripe,
    settlement: pendingSettlement,
    bookingId: booking.id,
    providerId: provider.id,
  });
  await markHeldPaid({
    appOrigin,
    webhookSecret,
    bookingId: booking.id,
    providerId: provider.id,
    settlement: pendingSettlement,
    intent,
  });

  const held = await assertBookingHeld(admin, booking.id, intent.id, charge.id);
  await markBookingCompletedForSettlement(admin, booking.id);
  await insertSettlementRiskAllow(admin, accountId, booking.id);

  const firstToken = randomUUID();
  const competingToken = randomUUID();
  const [claimA, claimB] = await Promise.all([
    claimRelease(admin, booking.id, firstToken),
    claimRelease(admin, booking.id, competingToken),
  ]);
  const createClaim = [claimA, claimB].find((claim) => claim.action === "create");
  const busyClaim = [claimA, claimB].find((claim) => claim.action === "busy");
  assert(createClaim && busyClaim, `Atomic claim race expected one create and one busy, got ${claimA.action}/${claimB.action}.`);

  const winningToken = createClaim === claimA ? firstToken : competingToken;
  assert(createClaim.attempt_number === 1, "First atomic release claim must use attempt 1.");
  assert(createClaim.stripe_charge_id === charge.id, "Atomic claim did not freeze the real charge id.");
  assert(createClaim.transfer_group === held.transfer_group, "Atomic claim transfer_group mismatch.");

  const transferParams = {
    amount: Number(createClaim.provider_amount_cents),
    currency: String(createClaim.currency).toLowerCase(),
    destination: createClaim.stripe_account_id,
    source_transaction: createClaim.stripe_charge_id,
    transfer_group: createClaim.transfer_group,
    metadata: {
      booking_id: booking.id,
      payment_mode: PAYMENT_MODE,
      settlement_attempt: String(createClaim.attempt_number),
    },
  };
  const transferIdempotencyKey = `klyx-booking-settlement-${booking.id}`;

  const acceptedTransfer = await stripe.transfers.create(transferParams, {
    idempotencyKey: transferIdempotencyKey,
  });
  assert(acceptedTransfer.livemode === false, "Provider Transfer unexpectedly used live mode.");
  assert(stripeObjectId(acceptedTransfer.source_transaction) === charge.id, "Real Transfer source_transaction does not equal the real charge.");
  assert(acceptedTransfer.transfer_group === held.transfer_group, "Real Transfer transfer_group mismatch.");
  assert(stripeObjectId(acceptedTransfer.destination) === held.stripe_account_id, "Real Transfer destination mismatch.");

  const { data: failedClaim, error: failedClaimError } = await admin.rpc(
    "klyx_fail_booking_settlement_release",
    {
      p_booking_id: booking.id,
      p_claim_token: winningToken,
      p_error_code: "network_timeout_after_stripe_acceptance",
      p_error_message: "Stripe TEST accepted Transfer; response intentionally treated as lost for retry proof.",
    }
  );
  if (failedClaimError) throw new Error(`Unable to model post-acceptance network timeout: ${failedClaimError.message}`);
  assert(failedClaim === true, "Timeout model did not reopen the settlement claim.");

  const afterTimeout = await loadSettlement(admin, booking.id);
  assert(afterTimeout.state === "release_failed", "Settlement must be release_failed after modeled timeout.");
  assert(afterTimeout.stripe_transfer_id === null, "DB must not invent a Transfer id after lost response.");

  const retryToken = randomUUID();
  const retryClaim = await claimRelease(admin, booking.id, retryToken);
  assert(retryClaim.action === "create", `Retry claim was not reopened: ${retryClaim.action}.`);
  assert(retryClaim.attempt_number === 2, "Retry claim must increment release attempt to 2.");

  const reconciledList = await stripe.transfers.list({
    transfer_group: retryClaim.transfer_group,
    destination: retryClaim.stripe_account_id,
    limit: 10,
  });
  const matchingTransfers = reconciledList.data.filter(
    (transfer) =>
      transfer.metadata?.booking_id === booking.id &&
      transfer.metadata?.payment_mode === PAYMENT_MODE
  );
  assert(matchingTransfers.length === 1, `transfer_group reconciliation expected one Transfer, found ${matchingTransfers.length}.`);
  const reconciledTransfer = matchingTransfers[0];
  assert(reconciledTransfer.id === acceptedTransfer.id, "Retry reconciliation found a different Transfer.");
  assert(stripeObjectId(reconciledTransfer.source_transaction) === charge.id, "Reconciled Transfer source_transaction mismatch.");

  const { data: finalizeData, error: finalizeError } = await admin.rpc(
    "klyx_finalize_booking_settlement_release",
    {
      p_booking_id: booking.id,
      p_claim_token: retryToken,
      p_stripe_transfer_id: reconciledTransfer.id,
    }
  );
  if (finalizeError) throw new Error(`Unable to finalize reconciled settlement: ${finalizeError.message}`);
  assert(finalizeData === true, "Reconciled settlement finalize returned false.");

  const idempotentTransfer = await stripe.transfers.create(transferParams, {
    idempotencyKey: transferIdempotencyKey,
  });
  assert(idempotentTransfer.id === acceptedTransfer.id, "Stripe Transfer idempotency produced a second object.");

  const afterIdempotentRetry = await stripe.transfers.list({
    transfer_group: held.transfer_group,
    destination: held.stripe_account_id,
    limit: 10,
  });
  const transferMatchesAfterRetry = afterIdempotentRetry.data.filter(
    (transfer) =>
      transfer.metadata?.booking_id === booking.id &&
      transfer.metadata?.payment_mode === PAYMENT_MODE
  );
  assert(transferMatchesAfterRetry.length === 1, "Retry created a double provider Transfer.");

  const terminalClaim = await claimRelease(admin, booking.id, randomUUID());
  assert(terminalClaim.action === "released", `Released settlement did not return released on retry: ${terminalClaim.action}.`);

  const released = await loadSettlement(admin, booking.id);
  assert(released.state === "released", `Settlement did not finalize released: ${released.state}.`);
  assert(released.stripe_transfer_id === acceptedTransfer.id, "DB released Transfer id mismatch.");
  assert(released.release_attempt_number === 2, "DB release attempt number mismatch after retry.");

  const { data: prepareData, error: prepareError } = await admin.rpc(
    "klyx_prepare_booking_settlement_refund",
    { p_booking_id: booking.id }
  );
  if (prepareError) throw new Error(`Unable to prepare post-release refund: ${prepareError.message}`);
  const prepared = (prepareData ?? [])[0];
  assert(prepared?.action === "reverse_transfer", `Post-release refund expected reverse_transfer, got ${prepared?.action}.`);
  assert(prepared.stripe_transfer_id === acceptedTransfer.id, "Refund preparation Transfer id mismatch.");

  const reversalKey = `klyx-booking-settlement-reversal-${booking.id}`;
  const reversalParams = {
    amount: Number(released.provider_amount_cents),
    metadata: {
      booking_id: booking.id,
      payment_mode: PAYMENT_MODE,
    },
  };
  const reversal = await stripe.transfers.createReversal(
    acceptedTransfer.id,
    reversalParams,
    { idempotencyKey: reversalKey }
  );
  const idempotentReversal = await stripe.transfers.createReversal(
    acceptedTransfer.id,
    reversalParams,
    { idempotencyKey: reversalKey }
  );
  assert(idempotentReversal.id === reversal.id, "Stripe reversal idempotency produced a second object.");

  const reversalList = await stripe.transfers.listReversals(acceptedTransfer.id, { limit: 100 });
  const matchingReversals = reversalList.data.filter(
    (candidate) =>
      candidate.metadata?.booking_id === booking.id &&
      candidate.metadata?.payment_mode === PAYMENT_MODE
  );
  assert(matchingReversals.length === 1, "Post-release retry created multiple Transfer reversals.");

  for (const attempt of [1, 2]) {
    const { data, error } = await admin.rpc("klyx_finalize_booking_settlement_reversal", {
      p_booking_id: booking.id,
      p_stripe_transfer_id: acceptedTransfer.id,
      p_stripe_transfer_reversal_id: reversal.id,
    });
    if (error) throw new Error(`Reversal finalize attempt ${attempt} failed: ${error.message}`);
    assert(data === true, `Reversal finalize attempt ${attempt} was not idempotent.`);
  }

  const afterReversal = await loadSettlement(admin, booking.id);
  assert(afterReversal.state === "refund_pending", "Settlement must remain refund_pending until customer refund succeeds.");
  assert(afterReversal.stripe_transfer_reversal_id === reversal.id, "DB reversal id mismatch.");

  const refund = await stripe.refunds.create(
    {
      payment_intent: intent.id,
      amount: Number(released.gross_amount_cents),
      metadata: {
        booking_id: booking.id,
        payment_mode: PAYMENT_MODE,
        klyx_network_proof: "post_release",
      },
    },
    { idempotencyKey: `klyx-booking-refund-network-proof-${booking.id}` }
  );
  assert(refund.livemode === false && refund.status === "succeeded", "Post-release Stripe TEST refund did not succeed.");

  const now = new Date().toISOString();
  const { error: terminalBookingError } = await admin
    .from("bookings")
    .update({
      payment_status: "refunded",
      refund_status: "succeeded",
      stripe_refund_id: refund.id,
      refunded_amount_cents: Number(released.gross_amount_cents),
      refunded_at: now,
      updated_at: now,
    })
    .eq("id", booking.id);
  if (terminalBookingError) throw new Error(`Unable to persist post-release terminal refund: ${terminalBookingError.message}`);

  const terminalSettlement = await loadSettlement(admin, booking.id);
  assert(terminalSettlement.state === "refunded", `Post-release settlement did not become refunded: ${terminalSettlement.state}.`);
  assert(terminalSettlement.stripe_transfer_id === acceptedTransfer.id, "Terminal settlement lost Transfer truth.");
  assert(terminalSettlement.stripe_transfer_reversal_id === reversal.id, "Terminal settlement lost reversal truth.");

  const remoteTransfer = await stripe.transfers.retrieve(acceptedTransfer.id);
  const remoteRefund = await stripe.refunds.retrieve(refund.id);
  assert(remoteTransfer.amount_reversed === Number(released.provider_amount_cents), "Remote Transfer is not fully reversed.");
  assert(remoteRefund.status === "succeeded" && stripeObjectId(remoteRefund.payment_intent) === intent.id, "Remote refund truth mismatch after retry.");

  await expireCheckout(stripe, released.stripe_checkout_session_id);

  return {
    bookingId: booking.id,
    paymentIntentId: intent.id,
    chargeId: charge.id,
    transferId: acceptedTransfer.id,
    reversalId: reversal.id,
    refundId: refund.id,
    transferGroup: held.transfer_group,
    sourceTransaction: stripeObjectId(remoteTransfer.source_transaction),
    releaseAttempts: terminalSettlement.release_attempt_number,
    transferCountAfterRetry: transferMatchesAfterRetry.length,
    reversalCountAfterRetry: matchingReversals.length,
    settlementState: terminalSettlement.state,
  };
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  assert(localSupabase, "Platform-held Stripe network proof is allowed only with ephemeral local Supabase.");

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  assert(appOrigin === "http://127.0.0.1:3100", "Platform-held proof requires isolated KLYX on 127.0.0.1:3100.");

  const stripeSecretKey = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const stripePublishableKey = requiredGoldenPathEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const webhookSecret = requiredGoldenPathEnv("STRIPE_WEBHOOK_SECRET");
  assert(stripeSecretKey.startsWith("sk_test_"), "Platform-held proof requires sk_test_* only; sk_live_* is forbidden.");
  assert(stripePublishableKey.startsWith("pk_test_"), "Platform-held proof requires pk_test_* only.");
  assert(process.env.KLYX_STRIPE_MODE === "test", "Platform-held proof requires KLYX_STRIPE_MODE=test.");
  assert(process.env.KLYX_STRIPE_SETTLEMENT_MODE === PAYMENT_MODE, "Platform-held settlement mode is not armed.");
  assert(process.env.KLYX_SETTLEMENT_CONTROL_TEST_READY === "true", "Platform-held test-ready guard is not armed.");
  assert(process.env.KLYX_LIVE_PAYMENTS_ENABLED === "false", "Live payments must remain disabled.");

  const publishableKey = requiredGoldenPathEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
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

  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate platform-held network proof account.");
  }

  const accessToken = signInData.session.access_token;
  const { client, provider, accountId } = await loadProfiles(admin, signInData.user.id);

  let connectedAccount = null;
  let connectedV2Account = null;
  let createdConnectedAccount = false;
  let cleanupFailure = null;

  try {
    const provisioned = await provisionConnectedAccount({
      stripe,
      providerId: provider.id,
    });
    connectedAccount = provisioned.account;
    connectedV2Account = provisioned.v2Account;
    createdConnectedAccount = provisioned.createdForProof;
    await bindCanonicalAccount(admin, accountId, connectedAccount);

    const refundBeforeRelease = await runRefundBeforeReleaseScenario({
      stripe,
      admin,
      appOrigin,
      accessToken,
      webhookSecret,
      client,
      provider,
    });

    const releaseRetryReversal = await runReleaseRetryReversalScenario({
      stripe,
      admin,
      appOrigin,
      accessToken,
      webhookSecret,
      client,
      provider,
      accountId,
    });

    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(
      `${PROOF_DIR}/platform-held-settlement-proof.json`,
      `${JSON.stringify(
        {
          verified: true,
          stripeTestNetwork: true,
          livemode: false,
          paymentMode: PAYMENT_MODE,
          scope: "single_booking_only",
          groupBookingEnabled: false,
          splitBookingEnabled: false,
          liveSecretAccepted: false,
          canonicalAccountStripeIdUsed: true,
          recipientTransferCapabilityActive: true,
          bankPayoutRequiredForRelease: false,
          refundBeforeRelease,
          releaseRetryReversal,
          invariants: {
            realPlatformCharge: true,
            heldSettlement: true,
            settlementReleaseDecision: true,
            completedBeforeClaim: true,
            atomicClaimRace: true,
            realTransfer: true,
            realSourceTransaction: true,
            retryAfterLostTransferResponse: true,
            reconciledByTransferGroup: true,
            noDoubleTransfer: true,
            idempotentReversal: true,
            dbStripeCoherentAfterRetry: true,
          },
          connectedAccountCreatedForProof: createdConnectedAccount,
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
        stripeTestNetwork: true,
        paymentMode: PAYMENT_MODE,
        refundBeforeRelease: true,
        atomicClaim: true,
        transferSourceTransaction: true,
        retryReconciledByTransferGroup: true,
        noDoubleTransfer: true,
        reversalIdempotent: true,
        dbStripeCoherent: true,
        liveForbidden: true,
        groupSplitForbidden: true,
        bankPayoutRequired: false,
      })}\n`
    );
  } finally {
    try {
      if (connectedAccount && connectedV2Account && createdConnectedAccount) {
        const configurations = connectedV2Account.applied_configurations ?? [];
        const closed = await stripe.v2.core.accounts.close(connectedAccount.id, {
          applied_configurations: configurations,
        });
        if (closed.closed !== true) {
          throw new Error(`Stripe did not confirm closure of proof account ${connectedAccount.id}.`);
        }
      }

      const { error: localResetError } = await admin
        .from("accounts")
        .update({
          stripe_account_id: null,
          stripe_connect_state: "unlinked",
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          stripe_status_updated_at: null,
        })
        .eq("id", accountId);
      if (localResetError) throw new Error(`Unable to reset local canonical Stripe fixture: ${localResetError.message}`);
    } catch (error) {
      cleanupFailure = error instanceof Error ? error.message : String(error);
    }

    await userClient.auth.signOut();
  }

  if (cleanupFailure) {
    throw new Error(`Platform-held proof cleanup failed: ${cleanupFailure}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX platform-held Stripe network proof failed: ${message}`);
  process.exitCode = 1;
});