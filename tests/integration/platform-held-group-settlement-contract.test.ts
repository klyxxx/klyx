import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("KLYX TEST-only platform-held group settlement", () => {
  it("keeps legacy group destination charges and adds held mode only through the dispatcher", () => {
    const wrapper = read("app/api/stripe/create-group-checkout-session/route.ts");
    const legacy = read("app/api/stripe/create-group-checkout-session/route-core.ts");
    const held = read(
      "app/api/stripe/create-group-checkout-session/route-platform-held-core.ts"
    );

    expect(wrapper).toContain("getKlyxSettlementMode()");
    expect(wrapper).toContain("KLYX_PLATFORM_HELD_SETTLEMENT_MODE");
    expect(wrapper).toContain("platformHeldPost(request)");
    expect(wrapper).toContain("corePost(request)");

    expect(legacy).toContain("paymentIntentData.application_fee_amount");
    expect(legacy).toContain("paymentIntentData.transfer_data");

    expect(held).toContain('subjectType: "booking_group"');
    expect(held).toContain("klyx_persist_platform_held_group_checkout");
    expect(held).toContain("transfer_group: plan.transferGroup");
    expect(held).not.toContain("paymentIntentData.transfer_data");
    expect(held).not.toContain("application_fee_amount:");
  });

  it("hard-blocks live Stripe keys and requires TEST recipient transfer capability", () => {
    const held = read(
      "app/api/stripe/create-group-checkout-session/route-platform-held-core.ts"
    );
    const release = read("lib/booking-group-settlement-server.ts");

    for (const source of [held, release]) {
      expect(source).toContain('startsWith("sk_live_")');
      expect(source).toContain('startsWith("sk_test_")');
    }

    expect(held).toContain("stripe.v2.core.accounts.retrieve");
    expect(held).toContain('stripe_transfers?.status === "active"');
    expect(release).toContain("currentRecipientTransferReady");
    expect(release).toContain("stripe_recipient_transfer_not_active");
    expect(release).not.toContain("stripe.payouts.create");
  });

  it("freezes one settlement for one group and one provider", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260918190000_klyx_platform_held_group_settlement_test.sql"
      )
    );

    expect(migration).toContain(
      "create table if not exists public.booking_group_settlements"
    );
    expect(migration).toContain(
      "booking_group_id uuid primary key references public.booking_groups"
    );
    expect(migration).toContain(
      "platform_fee_cents + provider_amount_cents = gross_amount_cents"
    );
    expect(migration).toContain(
      "KLYX_GROUP_HELD_CHILD_PROVIDER_MISMATCH"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_persist_platform_held_group_checkout"
    );
  });

  it("requires completed group truth, all paid completed children, canonical identity and fresh risk before claim", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260918190000_klyx_platform_held_group_settlement_test.sql"
      )
    );

    expect(migration).toContain("coalesce(v_group.status,'') <> 'completed'");
    expect(migration).toContain("coalesce(v_group.payment_status,'') <> 'paid'");
    expect(migration).toContain("coalesce(v_group.payment_mode,'') <> 'platform_held'");
    expect(migration).toContain(
      "coalesce(b.status,'') <> 'completed' or coalesce(b.payment_status,'') <> 'paid'"
    );
    expect(migration).toContain(
      "from public.account_stripe_connect_identities i"
    );
    expect(migration).toContain("coalesce(v_identity_state,'') <> 'linked'");
    expect(migration).toContain(
      "v_account_stripe_id is distinct from v_settlement.stripe_account_id"
    );
    expect(migration).toContain("d.action = 'settlement_release'");
    expect(migration).toContain("d.participant = 'settlement_recipient'");
    expect(migration).toContain("d.subject_type = 'booking_group'");
    expect(migration).toContain(
      "d.risk_assessed_at >= now() - interval '5 minutes'"
    );
  });

  it("creates at most one idempotent Transfer from the captured charge", () => {
    const release = read("lib/booking-group-settlement-server.ts");

    expect(release).toContain("klyx_claim_booking_group_settlement_release");
    expect(release).toContain("stripe.transfers.list({");
    expect(release).toContain("source_transaction: claim.stripe_charge_id");
    expect(release).toContain("transfer_group: claim.transfer_group");
    expect(release).toContain(
      '"klyx-booking-group-settlement-" + groupId'
    );
    expect(release).toContain(
      "KLYX_GROUP_SETTLEMENT_MULTIPLE_TRANSFERS_RECONCILIATION_REQUIRED"
    );
    expect(release).toContain(
      "KLYX_GROUP_SETTLEMENT_RELEASE_EXCEEDS_CAPTURE"
    );
    expect(release).toContain("let stripeAcceptedTransfer = false");
    expect(release).toContain("if (!stripeAcceptedTransfer)");
  });

  it("reverses a released group Transfer before the existing customer refund core", () => {
    const wrapper = read(
      "app/api/booking-groups/[id]/cancellation/route.ts"
    );
    const core = read(
      "app/api/booking-groups/[id]/cancellation/route-core.ts"
    );
    const release = read("lib/booking-group-settlement-server.ts");

    const risk = wrapper.indexOf("await enforceRefundTransactionRisk({");
    const prepare = wrapper.indexOf(
      "await preparePlatformHeldBookingGroupRefund(group.id)"
    );
    const delegate = wrapper.lastIndexOf("return corePost(request, context)");

    expect(prepare).toBeGreaterThan(risk);
    expect(delegate).toBeGreaterThan(prepare);
    expect(release).toContain("stripe.transfers.createReversal(");
    expect(release).toContain(
      '"klyx-booking-group-settlement-reversal-" + groupId'
    );
    expect(compact(core)).toContain(
      'group.payment_mode === "connect_destination"'
    );
    expect(core).toContain("reverse_transfer:");
  });

  it("keeps split settlement disabled while group settlement is certified", () => {
    const held = read(
      "app/api/stripe/create-group-checkout-session/route-platform-held-core.ts"
    );
    const single = read(
      "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
    );

    expect(held).not.toContain("split_booking_payment_units");
    expect(single).toContain("KLYX_PLATFORM_HELD_SPLIT_NOT_SUPPORTED");
  });

  it("keeps both settlement tables server-only", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260918190000_klyx_platform_held_group_settlement_test.sql"
      )
    );
    const registry = read("tests/unit/rls-server-only-boundary.test.ts");

    expect(migration).toContain(
      "revoke all privileges on table public.booking_group_settlements from public, anon, authenticated"
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.booking_group_settlements to service_role"
    );
    expect(registry).toContain('"booking_group_settlements"');
    expect(registry).toContain('"booking_settlements"');
  });
});
