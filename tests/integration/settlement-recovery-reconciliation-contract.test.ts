import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

const recovery = read("lib/booking-settlement-reconciliation-server.ts");
const settlement = read("lib/booking-settlement-server.ts");
const migration = compact(
  read(
    "supabase/migrations/20260918183500_klyx_settlement_recovery_reconciliation.sql"
  )
);
const trackingRoute = read("app/api/bookings/tracking/route.ts");
const statusRoute = read("app/api/bookings/status/route.ts");
const identity = read("lib/stripe-connect-account-identity.ts");
const webhookEvents = read("lib/stripe-webhook-events.ts");

describe("KLYX settlement recovery / reconciliation contract", () => {
  it("is server-only, TEST-only and contains no LLM financial mutation path", () => {
    expect(recovery).toContain('import "server-only"');
    expect(recovery).toContain('key.startsWith("sk_live_")');
    expect(recovery).toContain('key.startsWith("sk_test_")');
    expect(recovery).toContain("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
    expect(recovery).not.toContain("stripe.payouts.create");
    expect(recovery).not.toMatch(/from ["']@\/lib\/(brain|ai|llm)/);
    expect(recovery).not.toMatch(/openai/i);
  });

  it("searches Stripe truth before any recovery-triggered Transfer write", () => {
    const searchIndex = recovery.indexOf(
      'action: "stripe_truth_searched"'
    );
    const releaseIndex = recovery.indexOf(
      "await releasePlatformHeldBookingSettlement("
    );

    expect(searchIndex).toBeGreaterThan(-1);
    expect(releaseIndex).toBeGreaterThan(searchIndex);
    expect(recovery).toContain("await stripe.transfers.list({");
    expect(recovery).toContain("await stripe.transfers.retrieve(");
    expect(settlement).toContain("await reconcileExistingTransfer({");
    expect(settlement).toContain("stripe.transfers.create(");
    expect(settlement).toContain(
      "klyx-booking-settlement-${bookingId}"
    );
  });

  it("recovers Transfer-created / DB-not-finalized and stale-claim cases idempotently", () => {
    expect(recovery).toContain(
      '"klyx_record_booking_settlement_transfer_truth"'
    );
    expect(recovery).toContain(
      '"klyx_reconcile_booking_settlement_released"'
    );
    expect(recovery).toContain("const CLAIM_TTL_MS = 10 * 60 * 1000");
    expect(recovery).toContain(
      'settlement.state === "release_claimed" && freshClaim(settlement)'
    );
    expect(recovery).toContain(
      '["held", "release_claimed", "release_failed"].includes('
    );
    expect(recovery).toContain(
      'action: "release_after_truth_search"'
    );
  });

  it("recovers reversal-created / DB-not-finalized and fences refund against release", () => {
    const refundFenceIndex = recovery.indexOf(
      'input.source === "refund"'
    );
    const forceRefundIndex = recovery.indexOf(
      "await forceRefundPending(input.bookingId)"
    );
    const reversalSearchIndex = recovery.indexOf(
      "await findReversal("
    );
    const refundPreparationIndex = recovery.indexOf(
      "await preparePlatformHeldBookingRefund("
    );

    expect(refundFenceIndex).toBeGreaterThan(-1);
    expect(forceRefundIndex).toBeGreaterThan(refundFenceIndex);
    expect(reversalSearchIndex).toBeGreaterThan(forceRefundIndex);
    expect(refundPreparationIndex).toBeGreaterThan(reversalSearchIndex);
    expect(settlement).toContain("stripe.transfers.listReversals(");
    expect(settlement).toContain("stripe.transfers.createReversal(");
    expect(settlement).toContain(
      "klyx-booking-settlement-reversal-${bookingId}"
    );
  });

  it("uses Checkout for provenance and PaymentIntent + charge for active settlement financial truth", () => {
    expect(recovery).toContain(
      'settlement.state === "pending_payment"'
    );
    expect(recovery).toContain(
      'session.payment_status !== "paid"'
    );
    expect(recovery).toContain(
      'intent.status !== "succeeded"'
    );
    expect(recovery).toContain("payment_intent_charge_mismatch");
    expect(recovery).not.toContain(
      "settlement_active_but_checkout_not_paid"
    );
  });

  it("recovers absent or delayed payment/refund webhooks from Stripe truth", () => {
    expect(recovery).toContain("markBookingPaidFromSession");
    expect(recovery).toContain("reconcileStripeRefund");
    expect(recovery).toContain(
      'action: "recover_missing_payment_webhook"'
    );
    expect(recovery).toContain(
      'action: "recover_missing_refund_webhook"'
    );
    expect(webhookEvents).toContain("already_processed");
    expect(webhookEvents).toContain("attempt_count");
  });

  it("fails closed to durable human_review on canonical identity or immutable Stripe mismatch", () => {
    expect(recovery).toContain(
      "getProfileAccountStripeConnectIdentity"
    );
    expect(recovery).toContain(
      "assertStripeConnectIdentityUsable"
    );
    expect(recovery).toContain(
      "provider_stripe_identity_conflict"
    );
    expect(recovery).toContain("transfer_amount_mismatch");
    expect(recovery).toContain("transfer_currency_mismatch");
    expect(recovery).toContain("transfer_charge_mismatch");
    expect(recovery).toContain("payment_intent_charge_mismatch");
    expect(recovery).toContain("multiple_matching_transfers");
    expect(recovery).toContain("multiple_matching_reversals");
    expect(migration).toContain("'human_review'");
    expect(migration).toContain(
      "create or replace function public.klyx_mark_booking_settlement_human_review"
    );
    expect(identity).toContain(
      '"account_stripe_connect_identities"'
    );
  });

  it("keeps audit trail append-only and exposes required operational metrics", () => {
    expect(migration).toContain(
      "create table if not exists public.booking_settlement_reconciliation_events"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.booking_settlement_reconciliation_events from public, anon, authenticated, service_role"
    );
    expect(migration).toContain(
      "grant select, insert on table public.booking_settlement_reconciliation_events to service_role"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_booking_settlement_metrics()"
    );
    expect(migration).toContain(
      "count(*) filter (where s.state = 'held')"
    );
    expect(migration).toContain(
      "count(*) filter (where s.state = 'release_claimed')"
    );
    expect(migration).toContain(
      "count(*) filter (where s.state = 'release_failed')"
    );
    expect(migration).toContain(
      "s.state in ('review_required', 'human_review')"
    );
    expect(migration).toContain(
      "count(*) filter (where s.state = 'released')"
    );
    expect(migration).toContain(
      "s.stripe_transfer_reversal_id is not null"
    );
    expect(migration).toContain("percentile_cont(0.50)");
    expect(migration).toContain("percentile_cont(0.95)");
    expect(recovery).toContain(
      "getPlatformHeldSettlementMetrics"
    );
  });

  it("preserves single-booking-only scope and canonical account-first Stripe authority", () => {
    expect(recovery).toContain(
      "context.booking.booking_group_id"
    );
    expect(recovery).toContain(
      '"platform_held_scope_mismatch"'
    );
    expect(recovery).not.toContain("createGroup");
    expect(recovery).not.toContain("split_booking");
    expect(identity).toContain("account_id");
    expect(identity).toContain(
      '"account_stripe_connect_identities"'
    );
    expect(migration).not.toContain("from public.profiles");
    expect(migration).not.toContain("update public.profiles");
    expect(migration).not.toContain("insert into public.profiles");
  });

  it("wires recovery into release and refund boundaries without rolling back mission completion", () => {
    expect(trackingRoute).toContain(
      "reconcilePlatformHeldBookingSettlement"
    );
    expect(trackingRoute).toContain('source: "release"');
    expect(trackingRoute).toContain("const response = await corePost(request)");
    expect(trackingRoute).toContain("return response");

    expect(statusRoute).toContain(
      "reconcilePlatformHeldBookingSettlement"
    );
    expect(statusRoute).toContain('source: "refund"');
    expect(statusRoute).toContain("KLYX_SETTLEMENT_HUMAN_REVIEW");
    expect(statusRoute).toContain(
      "KLYX_SETTLEMENT_REFUND_RECONCILIATION_PENDING"
    );
  });

  it("provides bounded server-only batch reconciliation rather than blind retry loops", () => {
    expect(recovery).toContain(
      "export async function reconcilePendingPlatformHeldSettlements"
    );
    expect(recovery).toContain(
      "const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200)"
    );
    expect(recovery).toContain(
      '.order("updated_at", { ascending: true })'
    );
    expect(recovery).not.toContain("setInterval(");
    expect(recovery).not.toContain("while (true)");
  });
});
