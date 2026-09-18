import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

const migrationPath =
  "supabase/migrations/20260918211000_klyx_platform_held_group_multiexecutor_test.sql";
const refundHardeningMigrationPath =
  "supabase/migrations/20260918213000_klyx_platform_held_group_refund_hardening.sql";

describe("Platform-Held multi-executor group settlement contract", () => {
  it("uses the real multi-provider split batch as executor authority", () => {
    const migration = compact(read(migrationPath));
    const checkout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );

    expect(migration).toContain("references public.split_booking_batches(id)");
    expect(migration).toContain(
      "references public.split_booking_payment_confirmations(id)"
    );
    expect(migration).toContain("from public.split_booking_batch_items");
    expect(checkout).toContain('"split_booking_payment_confirmations"');
    expect(checkout).not.toContain('"booking_groups"');
  });

  it("creates one platform charge and never destination-charges executors", () => {
    const checkout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );

    expect(checkout).toContain("stripe.checkout.sessions.create(");
    expect(checkout).toContain("payment_intent_data:");
    expect(checkout).toContain("transfer_group: parent.transfer_group");
    expect(checkout).toContain(
      'klyx_flow: "platform_held_group_multiexecutor"'
    );
    expect(checkout).not.toContain("transfer_data:");
    expect(checkout).not.toContain("application_fee_amount:");
    expect(checkout).toContain("freezeMultiExecutorGroupEconomics");
  });

  it("freezes exact parent and executor accounting invariants", () => {
    const migration = compact(read(migrationPath));

    expect(migration).toContain(
      "platform_fee_cents + provider_amount_cents = gross_amount_cents"
    );
    expect(migration).toContain("v_gross_sum <> p_gross_amount_cents");
    expect(migration).toContain("v_fee_sum <> p_platform_fee_cents");
    expect(migration).toContain("v_provider_sum <> p_provider_amount_cents");
    expect(migration).toContain(
      "KLYX_GROUP_HELD_ACCOUNTING_TOTAL_MISMATCH"
    );
    expect(migration).toContain(
      "KLYX_GROUP_HELD_MEMBER_BOOKING_MISMATCH"
    );
    expect(migration).toContain(
      "KLYX_GROUP_HELD_MEMBER_STRIPE_IDENTITY_MISMATCH"
    );
  });

  it("binds every executor Transfer to the same source charge and transfer_group", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");

    expect(server).toContain("source_transaction: parent.stripe_charge_id");
    expect(server).toContain("transfer_group: parent.transfer_group");
    expect(server).toContain("group_settlement_member_id: member.id");
    expect(server).toContain(
      "transferSourceId(transfer) !== parent.stripe_charge_id"
    );
    expect(server).toContain(
      "transfer.transfer_group !== parent.transfer_group"
    );
  });

  it("searches Stripe truth before every member Transfer and caps aggregate release", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");
    const migration = compact(read(migrationPath));

    const initialList = server.indexOf(
      "await listAndValidateTransfers(stripe, parent, members)"
    );
    const claim = server.indexOf(
      '"klyx_claim_platform_held_group_member_release"'
    );
    const secondList = server.indexOf(
      "await listAndValidateTransfers(stripe, parent, members)",
      initialList + 1
    );
    const capacity = server.indexOf(
      "assertAggregateTransferCapacity({",
      secondList
    );
    const create = server.indexOf(
      "await stripe.transfers.create(",
      capacity
    );

    expect(initialList).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(initialList);
    expect(secondList).toBeGreaterThan(claim);
    expect(capacity).toBeGreaterThan(secondList);
    expect(create).toBeGreaterThan(capacity);

    expect(migration).toContain(
      "from public.platform_held_group_settlements p where p.id = v_member.group_settlement_id for update"
    );
    expect(migration).toContain(
      "KLYX_GROUP_HELD_AGGREGATE_OVERTRANSFER_GUARD"
    );
  });

  it("keeps one executor failure isolated from all other member rows", () => {
    const migration = compact(read(migrationPath));

    expect(migration).toContain(
      "create or replace function public.klyx_fail_platform_held_group_member_release"
    );
    expect(migration).toContain(
      "where id = p_member_id and state = 'release_claimed' and release_claim_token = p_claim_token"
    );
    expect(migration).not.toContain(
      "update public.platform_held_group_settlement_members set state = 'release_failed' where group_settlement_id"
    );
  });

  it("reuses the same checkout idempotency attempt after an unknown Stripe write", () => {
    const migration = compact(read(migrationPath));
    const checkout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );

    expect(migration).toContain("KEEP the same attempt number");
    expect(checkout).toContain("klyx-platform-held-group-");
    expect(checkout).toContain("-attempt-");
    expect(checkout).toContain("the SAME attempt number/idempotency key");
  });

  it("supports total refunds and server-derived partial refund economics", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");
    const route = read(
      "app/api/bookings/split-missions/[id]/refund/route.ts"
    );
    const migration = compact(read(migrationPath));
    const hardening = compact(read(refundHardeningMigrationPath));

    expect(server).toContain('kind: "total"');
    expect(server).toContain('kind: "partial"');
    expect(server).toContain("buildRemainingTotalAllocations");
    expect(server).toContain("buildPartialAllocations");
    expect(server).toContain("calculateCumulativeGroupRefundDelta");
    expect(server).toContain("validateExplicitGroupRefundAllocations");

    expect(route).toContain("partialRefundRequiresMemberGrossAllocation");
    expect(route).toContain("partialRefundEconomicsCalculatedServerSide");
    expect(route).not.toContain("platformFeeRefundCents = cents");
    expect(route).not.toContain("providerRefundCents = cents");

    expect(migration).toContain(
      "KLYX_GROUP_HELD_REFUND_ALLOCATION_TOTAL_MISMATCH"
    );
    expect(migration).toContain(
      "KLYX_GROUP_HELD_REFUND_MEMBER_EXCEEDS_FROZEN_ECONOMICS"
    );
    expect(migration).toContain("KLYX_GROUP_HELD_REFUND_EXCEEDS_GROSS");
    expect(migration).toContain("KLYX_GROUP_HELD_REFUND_ALREADY_ACTIVE");

    expect(hardening).toContain(
      "create or replace function public.klyx_guard_platform_held_group_refund_allocation_policy"
    );
    expect(hardening).toContain(
      "KLYX_GROUP_HELD_REFUND_ALLOCATION_POLICY_MISMATCH"
    );
    expect(hardening).toContain(
      "v_member.platform_fee_cents::numeric * v_cumulative_gross::numeric / v_member.gross_amount_cents::numeric"
    );
  });

  it("can finalize a Stripe refund after the DB marks it inflight", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");
    const hardening = compact(read(refundHardeningMigrationPath));

    const inflight = server.indexOf(
      '"klyx_mark_platform_held_group_refund_inflight"'
    );
    const stripeWrite = server.indexOf("stripe.refunds.create(", inflight);
    const finalize = server.indexOf("await finalizeRefund(", stripeWrite);

    expect(inflight).toBeGreaterThan(-1);
    expect(stripeWrite).toBeGreaterThan(inflight);
    expect(finalize).toBeGreaterThan(stripeWrite);
    expect(hardening).toContain(
      "if v_refund.state not in ('ready', 'refunding')"
    );
  });

  it("reverses each released executor allocation independently before customer refund", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");

    const listReversals = server.indexOf(
      "await input.stripe.transfers.listReversals"
    );
    const createReversal = server.indexOf(
      "await input.stripe.transfers.createReversal",
      listReversals
    );
    const finalizeReversal = server.indexOf(
      '"klyx_finalize_platform_held_group_member_reversal"',
      createReversal
    );
    const listRefunds = server.indexOf("await stripe.refunds.list({");
    const createRefund = server.indexOf(
      "stripeRefund = await stripe.refunds.create(",
      listRefunds
    );

    expect(listReversals).toBeGreaterThan(-1);
    expect(createReversal).toBeGreaterThan(listReversals);
    expect(finalizeReversal).toBeGreaterThan(createReversal);
    expect(listRefunds).toBeGreaterThan(finalizeReversal);
    expect(createRefund).toBeGreaterThan(listRefunds);
    expect(server).toContain("klyx-platform-held-group-reversal-");
    expect(server).toContain("klyx-platform-held-group-refund-");
  });

  it("is Stripe TEST-only for all new money movement", () => {
    const checkout = read(
      "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
    );
    const server = read("lib/platform-held-group-settlement-server.ts");

    for (const source of [checkout, server]) {
      expect(source).toContain('key.startsWith("sk_live_")');
      expect(source).toContain('key.startsWith("sk_test_")');
    }

    expect(server).toContain("stripe.transfers.create(");
    expect(server).toContain("stripe.transfers.createReversal(");
    expect(server).toContain("stripe.refunds.create(");
  });

  it("keeps certified single-booking settlement engine separate", () => {
    const server = read("lib/platform-held-group-settlement-server.ts");
    const migration = read(migrationPath);
    const dispatcher = read(
      "app/api/bookings/split-missions/[id]/checkout/route.ts"
    );

    expect(server).not.toContain('"booking_settlements"');
    expect(server).not.toContain("releasePlatformHeldBookingSettlement");
    expect(migration).not.toContain("alter table public.booking_settlements");
    expect(dispatcher).toContain("platformHeldPost");
    expect(dispatcher).toContain("corePost");
  });

  it("routes payment/refund webhook truth before legacy split handlers", () => {
    const webhook = read("app/api/stripe/webhook/route.ts");
    const group = read("lib/platform-held-group-payments.ts");

    const groupIndex = webhook.indexOf(
      "handlePlatformHeldGroupStripeWebhookEvent"
    );
    const splitIndex = webhook.indexOf(
      "handleSplitStripeWebhookEvent",
      groupIndex + 1
    );

    expect(groupIndex).toBeGreaterThan(-1);
    expect(splitIndex).toBeGreaterThan(groupIndex);
    expect(group).toContain("klyx_mark_platform_held_group_paid");
    expect(group).toContain("reconcilePlatformHeldGroupRefundFromStripe");
  });
});
