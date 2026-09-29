import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

describe("single Platform-Held partial refund contract", () => {
  const migration = read(
    "supabase/migrations/20260922170000_klyx_single_platform_held_partial_refund.sql"
  );
  const server = read(
    "lib/platform-held-booking-refund-server.ts"
  );
  const route = read(
    "app/api/bookings/[id]/refund/route.ts"
  );
  const release = read(
    "lib/booking-settlement-server.ts"
  );
  const webhook = read(
    "app/api/stripe/webhook/route.ts"
  );
  const refundProjection = read(
    "lib/stripe-refunds.ts"
  );
  const reconciliation = read(
    "lib/financial-ledger-reconciliation-server.ts"
  );

  it("adds cumulative Settlement truth without replacing frozen economics", () => {
    for (const column of [
      "refunded_amount_cents",
      "refunded_platform_fee_cents",
      "refunded_provider_amount_cents",
      "released_provider_amount_cents",
      "reversed_provider_amount_cents",
    ]) {
      expect(migration).toContain(column);
    }

    expect(migration).toContain(
      "refunded_platform_fee_cents + refunded_provider_amount_cents"
    );
    expect(migration).toContain(
      "= refunded_amount_cents"
    );
    expect(migration).toContain(
      "reversed_provider_amount_cents <= released_provider_amount_cents"
    );
    expect(migration).toContain(
      "booking_settlements_partial_refund_economics_check"
    );
  });

  it("uses deterministic cumulative nearest-cent allocation", () => {
    expect(migration).toContain(
      "v_settlement.platform_fee_cents * v_cumulative_gross"
    );
    expect(migration).toContain(
      "+ v_settlement.gross_amount_cents / 2"
    );
    expect(migration).toContain(
      "v_cumulative_provider := v_cumulative_gross - v_cumulative_fee"
    );
    expect(migration).toContain(
      "v_fee_delta + v_provider_delta <> p_amount_cents"
    );

    expect(reconciliation).toContain(
      "function cumulativeFeeRefund"
    );
    expect(reconciliation).toContain(
      "fee * refunded + gross / BigInt(2)"
    );
  });

  it("serializes release and refund on the same Settlement row", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain(
      "v_settlement.state not in ('held', 'release_failed', 'released')"
    );
    expect(migration).toContain(
      "set state = 'refund_pending'"
    );
    expect(migration).toContain(
      "settlement_state_before"
    );
    expect(migration).toContain(
      "KLYX_SINGLE_HELD_REFUND_ALREADY_ACTIVE"
    );
  });

  it("makes request-key retries and Stripe writes idempotent", () => {
    expect(migration).toContain(
      "unique (booking_id, request_key)"
    );
    expect(server).toContain(
      "klyx-platform-held-booking-refund-${refund.id}"
    );
    expect(server).toContain(
      "klyx-platform-held-booking-refund-reversal-${input.refund.id}"
    );
    expect(server).toContain(
      "platform_held_booking_refund_id"
    );
    expect(server).toContain(
      'if (input.refund.state === "refunding")'
    );
  });

  it("requires Risk and reconciliation inside the server mutation boundary", () => {
    const riskIndex = server.indexOf(
      "await enforceRefundTransactionRisk({"
    );
    const reconcileIndex = server.indexOf(
      "await reconcilePlatformHeldBookingSettlement({"
    );
    const runtimeIndex = server.indexOf(
      "await requireKlyxFinancialStripeRuntimeForBooking"
    );
    const planIndex = server.indexOf(
      '"klyx_create_platform_held_booking_refund_plan"'
    );

    expect(riskIndex).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(riskIndex);
    expect(runtimeIndex).toBeGreaterThan(reconcileIndex);
    expect(planIndex).toBeGreaterThan(runtimeIndex);

    expect(server).toContain('capability: "refunds"');
    expect(route).toContain("requesterAccount: account");
  });

  it("validates frozen Stripe Charge and released Transfer before creating the immutable refund plan", () => {
    const mutation = server.indexOf(
      "export async function refundSinglePlatformHeldBooking"
    );
    const chargeTruth = server.indexOf(
      "await verifyFrozenStripeCharge({",
      mutation
    );
    const transferTruth = server.indexOf(
      "await verifyReleasedTransfer({",
      chargeTruth
    );
    const plan = server.indexOf(
      '"klyx_create_platform_held_booking_refund_plan"',
      transferTruth
    );

    expect(mutation).toBeGreaterThan(-1);
    expect(chargeTruth).toBeGreaterThan(mutation);
    expect(transferTruth).toBeGreaterThan(chargeTruth);
    expect(plan).toBeGreaterThan(transferTruth);

    expect(server).toContain(
      "KLYX_SINGLE_HELD_CHARGE_TRUTH_MISMATCH"
    );
    expect(server).toContain(
      "KLYX_SINGLE_HELD_TRANSFER_TRUTH_MISMATCH"
    );
  });

  it("reverses only the provider refund delta and records immutable evidence", () => {
    expect(server).toContain(
      "amount: Number(input.refund.provider_refund_cents)"
    );
    expect(server).toContain(
      '"klyx_finalize_platform_held_booking_refund_reversal"'
    );
    expect(server).toContain("appendFinancialLedgerEvent");
    expect(server).toContain('movementType: "reversal"');

    expect(migration).toContain(
      "platform_held_booking_refund_reversals_immutable"
    );
    expect(migration).toContain(
      "KLYX_SINGLE_HELD_REFUND_REVERSAL_IMMUTABLE"
    );
    expect(migration).toContain(
      "grant select, insert on table public.platform_held_booking_refund_reversals"
    );
  });

  it("never creates the Stripe refund before a required reversal is reconciled", () => {
    const reversalIndex = server.indexOf(
      "await processRequiredReversal({"
    );
    const refundCreateIndex = server.indexOf(
      "stripeRefund = await stripe.refunds.create("
    );

    expect(reversalIndex).toBeGreaterThan(-1);
    expect(refundCreateIndex).toBeGreaterThan(reversalIndex);
  });

  it("survives timeout and late webhook without duplicating money movement", () => {
    expect(server).toContain(
      "listExistingRefundTruth"
    );
    expect(server).toContain(
      'refund.state !== "refunding"'
    );
    expect(server).toContain(
      "reconcileSinglePlatformHeldRefundFromStripe"
    );
    expect(webhook).toContain(
      "reconcileSinglePlatformHeldRefundFromStripe(refund)"
    );
    expect(webhook).toContain(
      "reconcileStripeRefund(refund)"
    );
  });

  it("projects a succeeded partial refund as partially_refunded instead of processing", () => {
    expect(migration).toContain("'partially_refunded'");
    expect(refundProjection).toContain(
      '| "partially_refunded"'
    );
    expect(refundProjection).toContain(
      '? "partially_refunded"'
    );
  });

  it("releases only the remaining provider liability through the canonical Transfer gateway", () => {
    const gateway = read("lib/beneficiary-transfer-gateway.ts");

    expect(migration).toContain(
      "klyx_booking_settlement_remaining_provider_amount"
    );
    expect(release).toContain(
      '"klyx_booking_settlement_remaining_provider_amount"'
    );
    expect(release).toContain(
      "const releaseAmountCents = Number(remainingProviderAmount)"
    );
    expect(release).toContain(
      "createEconomicallyAuthorizedBeneficiaryTransfer"
    );
    expect(release).toContain(
      "amount: releaseAmountCents"
    );
    expect(release).toContain(
      "expectedAmountCents: releaseAmountCents"
    );
    expect(release).not.toContain("stripe.transfers.create(");
    expect(gateway).toContain("stripe.transfers.create(");
    expect(gateway).toContain("canReceiveSettlementForBooking");
    expect(gateway).toContain("readStripeSettlementRecipientTruth");
    expect(migration).toContain(
      "released_provider_amount_cents ="
    );
  });

  it("mirrors actual released amount and suppresses legacy reversal double counting", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_mirror_booking_settlement_to_central"
    );
    expect(migration).toContain(
      "v_released_provider_amount"
    );
    expect(migration).toContain(
      "greatest(v_released_provider_amount, 0)"
    );
    expect(migration).toContain(
      "platform_held_booking_refund_reversals"
    );
    expect(migration).toContain(
      "and not exists ("
    );
  });

  it("reconstructs actual released amount during both Transfer recovery paths", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_reconcile_booking_settlement_release("
    );
    expect(migration).toContain(
      "create or replace function public.klyx_reconcile_booking_settlement_released("
    );
    expect(migration).toContain(
      "v_settlement.provider_amount_cents"
    );
    expect(migration).toContain(
      "- v_settlement.refunded_provider_amount_cents"
    );
    expect(migration).toContain(
      "released_provider_amount_cents = v_release_amount"
    );
  });

  it("keeps refunded terminal state reserved for exact full cumulative truth", () => {
    expect(migration).toContain(
      "v_full := v_total_refunded = v_settlement.gross_amount_cents"
    );
    expect(migration).toContain(
      "KLYX_SINGLE_HELD_FULL_REFUND_REVERSAL_INCOMPLETE"
    );
    expect(migration).toContain(
      "KLYX_SETTLEMENT_FULL_REFUND_TRUTH_INCOMPLETE"
    );
    expect(migration).toContain(
      "reversed_provider_amount_cents"
    );
  });

  it("makes central reconciliation compare Booking, Settlement, Ledger and Stripe amounts", () => {
    expect(reconciliation).toContain(
      "single_settlement_refund_cumulative_mismatch"
    );
    expect(reconciliation).toContain(
      "single_settlement_reversal_cumulative_mismatch"
    );
    expect(reconciliation).toContain(
      "single_settlement_released_amount_without_transfer"
    );
    expect(reconciliation).toContain(
      "settlement.released_provider_amount_cents"
    );
    expect(reconciliation).toContain(
      "stripe_transfer_settlement_amount_mismatch"
    );
  });

  it("does not activate general LIVE or weaken canonical certification gates", () => {
    expect(server).not.toContain(
      'process.env.KLYX_LIVE_PAYMENTS_ENABLED = "true"'
    );
    expect(route).not.toContain("STRIPE_SECRET_KEY");
    expect(migration).not.toContain("stripe_live");
    expect(migration).not.toContain("KLYX_LIVE_PAYMENTS_ENABLED");
  });
});
