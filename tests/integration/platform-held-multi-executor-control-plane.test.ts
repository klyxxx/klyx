import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260918210000_klyx_platform_held_multi_executor_group.sql"
    ),
    "utf8"
  )
  .replace(/\s+/g, " ");

describe("KLYX multi-executor platform-held control plane", () => {
  it("preserves legacy split and adds explicit held topology", () => {
    expect(source).toContain("'connect_destination_split'");
    expect(source).toContain("'platform_held_split'");
    expect(source).toContain("payment_mode <> 'platform_held_split'");
  });

  it("uses one run charge and one executor settlement per payment unit", () => {
    expect(source).toContain("stripe_payment_intent_id text");
    expect(source).toContain("stripe_charge_id text");
    expect(source).toContain("transfer_group text");
    expect(source).toContain("stripe_transfer_id text");
    expect(source).toContain("provider_refund_liability_cents bigint");
  });

  it("serializes executor release on the run and prevents aggregate over-transfer", () => {
    expect(source).toContain("where id = v_unit.run_id for update");
    expect(source).toContain("KLYX_SPLIT_HELD_AGGREGATE_OVER_TRANSFER_GUARD");
    expect(source).toContain("v_other_committed + v_release > v_run.provider_amount_cents");
    expect(source).toContain("v_other_committed + v_release > v_run.total_amount_cents");
  });

  it("requires canonical account-first Stripe identity and fresh release risk", () => {
    expect(source).toContain("account_stripe_connect_identities");
    expect(source).toContain("v_identity_state <> 'linked'");
    expect(source).toContain("d.subject_type = 'split_batch'");
    expect(source).toContain("d.subject_id = p_unit_id::text");
    expect(source).toContain("d.decision = 'allow'");
  });

  it("plans partial refunds deterministically and fences refund/release races", () => {
    expect(source).toContain("KLYX_SPLIT_HELD_REFUND_RELEASE_RACE");
    expect(source).toContain("order by provider_profile_id, id");
    expect(source).toContain("v_new_unit_refunded = v_unit.amount_cents");
    expect(source).toContain("provider_liability_delta_cents");
    expect(source).toContain("reversal_required_cents");
  });

  it("keeps financial tables server-only", () => {
    expect(source).toContain(
      "revoke all privileges on table public.split_booking_held_refunds from public, anon, authenticated"
    );
    expect(source).toContain(
      "revoke all privileges on table public.split_booking_held_refund_allocations from public, anon, authenticated"
    );
    expect(source).toContain("to service_role");
  });
});
