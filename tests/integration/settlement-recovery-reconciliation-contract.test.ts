import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

const migrationPath =
  "supabase/migrations/20260918190000_klyx_settlement_recovery_reconciliation.sql";

describe("KLYX settlement recovery / reconciliation contract", () => {
  it("is additive, server-only and single-booking only", () => {
    const migration = compact(read(migrationPath));
    const server = read("lib/booking-settlement-recovery-server.ts");

    expect(migration).toContain(
      "create table if not exists public.booking_settlement_recovery_events"
    );
    expect(migration).toContain(
      "alter table public.booking_settlement_recovery_events enable row level security"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.booking_settlement_recovery_events from public, anon, authenticated"
    );
    expect(migration).toContain("to service_role");
    expect(migration).toContain("v_booking.booking_group_id is not null");
    expect(server).toContain("booking.booking_group_id !== null");
    expect(server).not.toContain("booking_groups");
    expect(server).not.toContain("split_mission");
  });

  it("rejects Stripe live and recovery itself never creates money movement", () => {
    const server = read("lib/booking-settlement-recovery-server.ts");

    expect(server).toContain('key.startsWith("sk_live_")');
    expect(server).toContain('key.startsWith("sk_test_")');
    expect(server).toContain("stripe.paymentIntents.retrieve");
    expect(server).toContain("stripe.charges.retrieve");
    expect(server).toContain("stripe.transfers.list({");
    expect(server).toContain("stripe.transfers.listReversals");
    expect(server).not.toContain("stripe.transfers.create(");
    expect(server).not.toContain("stripe.transfers.createReversal(");
    expect(server).not.toContain("stripe.refunds.create(");
    expect(server).not.toContain("stripe.payouts.create(");
  });

  it("reads Stripe truth before applying a recovery mutation", () => {
    const server = read("lib/booking-settlement-recovery-server.ts");

    const intentIndex = server.indexOf("stripe.paymentIntents.retrieve");
    const transferListIndex = server.indexOf("stripe.transfers.list({");
    const classifyIndex = server.lastIndexOf(
      "classifySettlementRecoveryObservation({"
    );
    const applyIndex = server.lastIndexOf("await applyObservation({");

    expect(intentIndex).toBeGreaterThan(-1);
    expect(transferListIndex).toBeGreaterThan(intentIndex);
    expect(classifyIndex).toBeGreaterThan(transferListIndex);
    expect(applyIndex).toBeGreaterThan(classifyIndex);
  });

  it("verifies frozen charge, amount, currency, destination, source_transaction and transfer_group", () => {
    const server = read("lib/booking-settlement-recovery-server.ts");

    expect(server).toContain("PAYMENT_INTENT_AMOUNT_MISMATCH");
    expect(server).toContain("PAYMENT_INTENT_CURRENCY_MISMATCH");
    expect(server).toContain("PAYMENT_INTENT_TRANSFER_GROUP_MISMATCH");
    expect(server).toContain("CHARGE_ID_MISMATCH");
    expect(server).toContain("TRANSFER_AMOUNT_MISMATCH");
    expect(server).toContain("TRANSFER_CURRENCY_MISMATCH");
    expect(server).toContain("TRANSFER_DESTINATION_MISMATCH");
    expect(server).toContain("TRANSFER_SOURCE_TRANSACTION_MISMATCH");
    expect(server).toContain("TRANSFER_GROUP_MISMATCH");
  });

  it("uses canonical account Stripe identity and fails provider conflicts closed", () => {
    const server = read("lib/booking-settlement-recovery-server.ts");

    expect(server).toContain('"account_stripe_connect_identities"');
    expect(server).toContain('"stripe_account_id, identity_state"');
    expect(server).toContain('identity.identity_state !== "linked"');
    expect(server).toContain("CANONICAL_STRIPE_DESTINATION_CONFLICT");
    expect(server).not.toContain("profile.stripe_account_id");
  });

  it("makes expired-claim recovery conditional on verified absence of a Transfer", () => {
    const classifier = read("lib/booking-settlement-recovery.ts");
    const migration = compact(read(migrationPath));

    expect(classifier).toContain('action: "reconcile_no_transfer"');
    expect(classifier).toContain('"EXPIRED_CLAIM_NO_STRIPE_TRANSFER"');
    expect(migration).toContain(
      "v_settlement.state = 'release_claimed' and v_settlement.release_claimed_at is not null and v_settlement.release_claimed_at <= now() - interval '10 minutes' and v_settlement.stripe_transfer_id is null"
    );
    expect(migration).toContain("set state = 'release_failed'");
  });

  it("keeps refund/release races and irrecoverable ambiguity in review", () => {
    const classifier = read("lib/booking-settlement-recovery.ts");
    const server = read("lib/booking-settlement-recovery-server.ts");

    expect(classifier).toContain("MULTIPLE_STRIPE_TRANSFERS");
    expect(classifier).toContain("MULTIPLE_STRIPE_REVERSALS");
    expect(classifier).toContain(
      "TERMINAL_REFUND_WITH_UNREVERSED_TRANSFER"
    );
    expect(server).toContain(
      "PARTIAL_STRIPE_REFUND_REQUIRES_HUMAN_REVIEW"
    );
    expect(server).toContain("STRIPE_REFUND_TERMINAL_NOT_PERSISTED");
    expect(classifier).toContain("SETTLEMENT_REVIEW_IS_STICKY");
  });

  it("provides an idempotent audit trail and required operational metrics", () => {
    const migration = compact(read(migrationPath));

    expect(migration).toContain("unique (booking_id, observation_key)");
    expect(migration).toContain("recovery_attempt_number");
    expect(migration).toContain("last_recovery_status");
    expect(migration).toContain("last_reconciled_at");
    expect(migration).toContain(
      "create or replace function public.klyx_booking_settlement_recovery_metrics()"
    );
    expect(migration).toContain("held_count");
    expect(migration).toContain("pending_release_count");
    expect(migration).toContain("failed_count");
    expect(migration).toContain("review_count");
    expect(migration).toContain("released_count");
    expect(migration).toContain("reversed_count");
    expect(migration).toContain("avg_settlement_seconds");
    expect(migration).toContain("p95_settlement_seconds");
  });

  it("proves Mission 4 recovery against real Stripe TEST Transfer and reversal truth", () => {
    const proof = read("scripts/golden-path-platform-held-settlement-network.mjs");

    expect(proof).toContain('"klyx_apply_booking_settlement_recovery"');
    expect(proof).toContain('p_action: "reconcile_release"');
    expect(proof).toContain('p_action: "reconcile_reversal"');
    expect(proof).toContain('recoveryRelease?.state_before === "release_claimed"');
    expect(proof).toContain('recoveryRelease?.state_after === "released"');
    expect(proof).toContain('duplicateRecovery?.result === "duplicate"');
    expect(proof).toContain('reversalRecovery?.state_after === "refund_pending"');
    expect(proof).toContain("Mission 4 recovery must not create a second release claim".replace(
      "Mission 4 recovery must not create a second release claim",
      "Recovery must not create a second release claim"
    ));
  });

  it("exposes recovery only behind Founder authentication", () => {
    const route = read("app/api/founder/settlement-recovery/route.ts");

    expect(route).toContain("await requireKlyxFounder()");
    expect(route).toContain("reconcilePlatformHeldBookingSettlement");
    expect(route).toContain("reconcilePlatformHeldSettlementBacklog");
    expect(route).toContain("getPlatformHeldSettlementRecoveryMetrics");
    expect(route).toContain('"moneyMovementByRecovery: false"'.replace(
      '"moneyMovementByRecovery: false"',
      "moneyMovementByRecovery: false"
    ));
  });
});
