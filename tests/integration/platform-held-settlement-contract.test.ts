import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("KLYX platform-held settlement phase-2 contract", () => {
  it("keeps legacy destination checkout unchanged and routes held mode additively", () => {
    const wrapper = read("app/api/stripe/create-checkout-session/route.ts");
    const legacy = read("app/api/stripe/create-checkout-session/route-core.ts");
    const heldWrapper = read(
      "app/api/stripe/create-checkout-session/route-platform-held.ts"
    );
    const heldCore = read(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );

    expect(wrapper).toContain("getKlyxSettlementMode()");
    expect(wrapper).toContain("KLYX_PLATFORM_HELD_SETTLEMENT_MODE");
    expect(wrapper).toContain("platformHeldPost(request)");
    expect(wrapper).toContain("corePost(request)");

    expect(legacy).toContain("paymentIntentData.application_fee_amount");
    expect(legacy).toContain("paymentIntentData.transfer_data");

    expect(heldWrapper).toContain('POST as corePost } from "./route-platform-held-core"');
    expect(heldCore).toContain('transfer_group: plan.transferGroup');
    expect(heldCore).toContain('payment_mode: plan.paymentMode');
    expect(heldCore).toContain("klyx_persist_platform_held_checkout");
    expect(heldCore).not.toContain("paymentIntentData.transfer_data");
    expect(heldCore).not.toContain("application_fee_amount:");
    expect(heldCore).toContain("KLYX_PLATFORM_HELD_GROUP_NOT_SUPPORTED");
    expect(heldCore).toContain("KLYX_PLATFORM_HELD_SPLIT_NOT_SUPPORTED");
  });

  it("fails closed on a COMPLETE cross-mode checkout whose async payment is still pending", () => {
    const wrapper = read(
      "app/api/stripe/create-checkout-session/route-platform-held.ts"
    );

    const completeGuardIndex = wrapper.indexOf(
      'existingSession.status === "complete"'
    );
    const pendingGuardIndex = wrapper.indexOf(
      'existingSession.payment_status !== "paid"'
    );
    const pendingResponseIndex = wrapper.indexOf(
      '"KLYX_PLATFORM_HELD_CROSS_MODE_PAYMENT_PENDING"'
    );
    const delegateIndex = wrapper.lastIndexOf("return corePost(request)");

    expect(completeGuardIndex).toBeGreaterThan(-1);
    expect(pendingGuardIndex).toBeGreaterThan(completeGuardIndex);
    expect(pendingResponseIndex).toBeGreaterThan(pendingGuardIndex);
    expect(delegateIndex).toBeGreaterThan(pendingResponseIndex);
  });

  it("persists checkout and frozen settlement truth atomically at the database boundary", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260915194500_klyx_platform_held_settlement_test.sql"
      )
    );

    expect(migration).toContain(
      "create or replace function public.klyx_persist_platform_held_checkout"
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("payment_status = 'checkout_created'");
    expect(migration).toContain("payment_mode = 'platform_held'");
    expect(migration).toContain("insert into public.booking_settlements");
    expect(migration).toContain("'pending_payment'");
    expect(migration).toContain("KLYX_PLATFORM_HELD_PAYMENT_CLAIM_LOST");
    expect(migration).toContain("KLYX_PLATFORM_HELD_IMMUTABLE_TRUTH_MISMATCH");
  });

  it("turns paid platform-held bookings into held settlement truth without letting legacy economics overwrite it", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260915194500_klyx_platform_held_settlement_test.sql"
      )
    );

    expect(migration).toContain("klyx_guard_platform_held_booking_economics");
    expect(migration).toContain("klyx_mark_platform_held_booking_paid");
    expect(migration).toContain("klyx_guard_platform_held_ledger_economics");
    expect(migration).toContain("new.platform_fee_amount := v_settlement.platform_fee_cents");
    expect(migration).toContain("new.provider_amount := v_settlement.provider_amount_cents");
    expect(migration).toContain("state = case when state = 'pending_payment' then 'held'");
  });

  it("gates provider release before the executable reconciliation call and Stripe Transfer", () => {
    const release = read("lib/booking-settlement-server.ts");
    const risk = read("lib/transaction-risk-server.ts");

    const releaseFunctionIndex = release.indexOf(
      "export async function releasePlatformHeldBookingSettlement"
    );
    const riskIndex = release.indexOf(
      "await enforceSettlementReleaseTransactionRisk({",
      releaseFunctionIndex
    );
    const claimIndex = release.indexOf(
      '"klyx_claim_booking_settlement_release"',
      riskIndex
    );
    const reconcileCallIndex = release.indexOf(
      "transfer = await reconcileExistingTransfer({",
      claimIndex
    );
    const createIndex = release.indexOf(
      "transfer = await stripe.transfers.create(",
      reconcileCallIndex
    );

    expect(releaseFunctionIndex).toBeGreaterThan(-1);
    expect(riskIndex).toBeGreaterThan(releaseFunctionIndex);
    expect(claimIndex).toBeGreaterThan(riskIndex);
    expect(reconcileCallIndex).toBeGreaterThan(claimIndex);
    expect(createIndex).toBeGreaterThan(reconcileCallIndex);
    expect(release).toContain("stripe.transfers.list({");
    expect(release).toContain("source_transaction: claim.stripe_charge_id");
    expect(release).toContain("transfer_group: claim.transfer_group");
    expect(release).toContain("klyx-booking-settlement-${bookingId}");
    expect(release).toContain("KLYX_SETTLEMENT_MULTIPLE_TRANSFERS_RECONCILIATION_REQUIRED");
    expect(risk).toContain('action: "settlement_release"');
    expect(risk).toContain('participant: "settlement_recipient"');
  });

  it("never reopens a release claim after Stripe accepted money movement", () => {
    const release = read("lib/booking-settlement-server.ts");

    expect(release).toContain("let stripeAcceptedTransfer = false");
    expect(release).toContain("stripeAcceptedTransfer = true");
    expect(release).toContain("if (!stripeAcceptedTransfer)");
    expect(release).toContain("KLYX_SETTLEMENT_RELEASE_FINALIZE_LOST");
  });

  it("verifies the TEST parent Transfer before reversal and only then refunds the customer", () => {
    const wrapper = read("app/api/bookings/status/route.ts");
    const core = read("app/api/bookings/status/route-core.ts");
    const release = read("lib/booking-settlement-server.ts");

    const riskIndex = wrapper.indexOf("await enforceRefundTransactionRisk({");
    const settlementIndex = wrapper.indexOf("await preparePlatformHeldBookingRefund(");
    const coreIndex = wrapper.lastIndexOf("return corePost(request)");
    const refundFunctionIndex = release.indexOf(
      "export async function preparePlatformHeldBookingRefund"
    );
    const parentRetrieveIndex = release.indexOf(
      "await stripe.transfers.retrieve(transferId)",
      refundFunctionIndex
    );
    const verifyParentIndex = release.indexOf(
      "verifyTransferTruth({",
      parentRetrieveIndex
    );
    const listReversalIndex = release.indexOf(
      "stripe.transfers.listReversals(",
      verifyParentIndex
    );
    const createReversalIndex = release.indexOf(
      "stripe.transfers.createReversal(",
      listReversalIndex
    );

    expect(settlementIndex).toBeGreaterThan(riskIndex);
    expect(coreIndex).toBeGreaterThan(settlementIndex);
    expect(parentRetrieveIndex).toBeGreaterThan(refundFunctionIndex);
    expect(verifyParentIndex).toBeGreaterThan(parentRetrieveIndex);
    expect(listReversalIndex).toBeGreaterThan(verifyParentIndex);
    expect(createReversalIndex).toBeGreaterThan(listReversalIndex);
    expect(release).toContain("const metadata = reversal.metadata ?? {}");
    expect(release).toContain("klyx-booking-settlement-reversal-${bookingId}");
    expect(core).toContain("booking.payment_mode === \"connect_destination\"");
    expect(core).toContain("refundParameters.reverse_transfer = true");
  });

  it("keeps mission completion authoritative while settlement release remains fail-closed", () => {
    const wrapper = read("app/api/bookings/tracking/route.ts");
    const core = read("app/api/bookings/tracking/route-core.ts");

    expect(wrapper).toContain("await corePost(request)");
    expect(wrapper).toContain('action === "client_confirmed"');
    expect(wrapper).toContain("await releasePlatformHeldBookingSettlement(bookingId)");
    expect(wrapper).toContain("return response");
    expect(core).toContain('status: "completed"');
    expect(core).toContain('.eq("status", "accepted")');
  });

  it("consumes the exact TEST recipient handoff without v1 list rediscovery", () => {
    const fixture = read("scripts/golden-path-provider-fixture.mjs");
    const proof = read("scripts/golden-path-platform-held-settlement-network.mjs");

    expect(fixture).toContain(
      '"stripe-network-proof/platform-held-provider-fixture.json"'
    );
    expect(fixture).toContain("accountId: stripeFixture.accountId");
    expect(fixture).toContain("created: stripeFixture.created");
    expect(proof).toContain("loadPlatformHeldFixtureHandoff(providerId)");
    expect(proof).toContain(
      "stripe.v2.core.accounts.retrieve(handoff.accountId"
    );
    expect(proof).toContain("stripe.accounts.retrieve(handoff.accountId)");
    expect(proof).not.toContain(
      "async function findPlatformHeldRecipientAccount"
    );
    expect(proof).toContain("createdForProof: handoff.created");
    expect(proof).toContain(
      "if (connectedAccount && connectedV2Account && createdConnectedAccount)"
    );
  });

  it("is TEST-only, server-only and never creates bank payouts", () => {
    const heldWrapper = read(
      "app/api/stripe/create-checkout-session/route-platform-held.ts"
    );
    const heldCore = read(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );
    const release = read("lib/booking-settlement-server.ts");
    const migration = compact(
      read(
        "supabase/migrations/20260915194500_klyx_platform_held_settlement_test.sql"
      )
    );

    expect(heldWrapper).toContain('key.startsWith("sk_live_")');
    expect(heldWrapper).toContain('key.startsWith("sk_test_")');
    expect(heldCore).toContain('key.startsWith("sk_live_")');
    expect(heldCore).toContain('key.startsWith("sk_test_")');
    expect(release).toContain('key.startsWith("sk_live_")');
    expect(release).toContain('key.startsWith("sk_test_")');
    expect(release).not.toContain("stripe.payouts.create");
    expect(heldWrapper).not.toContain("stripe.payouts.create");
    expect(heldCore).not.toContain("stripe.payouts.create");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
