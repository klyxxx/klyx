import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX central financial ledger", () => {
  const migration = read(
    "supabase/migrations/20260920091500_klyx_central_financial_ledger.sql"
  );
  const groupSplitMigration = read(
    "supabase/migrations/20260920094500_klyx_central_financial_ledger_group_split.sql"
  );
  const server = read("lib/financial-ledger-server.ts");
  const reconciliation = read(
    "lib/financial-ledger-reconciliation-server.ts"
  );
  const ops = read("app/api/ops/financial-reconciliation/route.ts");

  it("defines every required financial movement as KLYX-owned accounting truth", () => {
    for (const movement of [
      "charge",
      "commission",
      "provider_liability",
      "transfer",
      "reversal",
      "refund",
      "payout",
    ]) {
      expect(migration).toContain(`'${movement}'`);
    }

    expect(migration).toContain("public.financial_ledger_events");
    expect(migration).toContain("movement_key text not null");
    expect(migration).toContain("event_key text not null unique");
    expect(migration).toContain("amount_minor bigint not null");
    expect(migration).not.toContain("amount_cents bigint not null");
    expect(migration).toContain("p_amount_minor bigint");
    const appendFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.klyx_append_financial_ledger_event"
      ),
      migration.indexOf("create or replace view public.financial_ledger_current")
    );
    expect(appendFunction).toContain("movement_type,\n    amount_minor,\n    currency,");
    expect(appendFunction).not.toContain("movement_type,\n    amount_cents,\n    currency,");
    expect(server).toContain("amountMinor: number");
    expect(migration).toContain("currency text not null");
    expect(migration).toContain("booking_id uuid not null");
    expect(migration).toContain("beneficiary_kind text not null");
    expect(migration).toContain("beneficiary_ref text not null");
    expect(migration).toContain("previous_state text");
    expect(migration).toContain("new_state text not null");
    expect(migration).toContain("occurred_at timestamptz not null");
    expect(migration).toContain("payload_hash text not null");
    expect(migration).toContain("set search_path = public, extensions");
    expect(migration).not.toMatch(/\nas \$\n/);
    expect(migration).not.toMatch(/\n\$;\n/);
    expect(groupSplitMigration).not.toMatch(/\nas \$\n/);
    expect(groupSplitMigration).not.toMatch(/\n\$;\n/);
  });

  it("stores Stripe identifiers only as evidence on immutable KLYX events", () => {
    for (const column of [
      "stripe_account_id",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "stripe_charge_id",
      "stripe_transfer_id",
      "stripe_transfer_reversal_id",
      "stripe_refund_id",
      "stripe_payout_id",
    ]) {
      expect(migration).toContain(`${column} text`);
    }

    expect(migration).toContain("KLYX_FINANCIAL_AUDIT_IMMUTABLE");
    expect(migration).toContain("before update or delete on public.financial_ledger_events");
    expect(migration).toContain(
      "before update or delete on public.financial_reconciliation_cases"
    );
    expect(migration).toContain(
      "before update or delete on public.financial_reconciliation_events"
    );
    expect(migration).not.toContain(
      "grant update on table public.financial_ledger_events"
    );
    expect(migration).not.toContain(
      "grant delete on table public.financial_ledger_events"
    );
  });

  it("keeps the old booking ledger as a compatibility projection, never central authority", () => {
    expect(migration).toContain(
      "booking_financial_ledger remains a compatibility projection/read model"
    );
    expect(migration).toContain(
      "booking_financial_ledger_central_mirror"
    );
    expect(migration).toContain(
      "booking_settlements_central_ledger_mirror"
    );
    expect(migration).toContain("historical_backfill");
    expect(migration).toContain("legacy_destination_charge");
    expect(migration).toContain("settlement_charge_truth_observed");
  });

  it("never overwrites an immutable event-key conflict", () => {
    expect(migration).toContain("immutable_event_key_conflict");
    expect(migration).toContain("'human_review'");
    expect(migration).toContain(
      "perform public.klyx_open_financial_reconciliation_case"
    );

    const appendStart = migration.indexOf(
      "create or replace function public.klyx_append_financial_ledger_event"
    );
    const currentView = migration.indexOf(
      "create or replace view public.financial_ledger_current"
    );
    const appendBody = migration.slice(appendStart, currentView);

    expect(appendBody).not.toContain(
      "update public.financial_ledger_events"
    );
    expect(appendBody).not.toContain(
      "delete from public.financial_ledger_events"
    );
  });

  it("records reconciliation and human decisions append-only instead of silently correcting truth", () => {
    expect(migration).toContain("public.financial_reconciliation_cases");
    expect(migration).toContain("public.financial_reconciliation_events");
    expect(migration).toContain(
      "state in ('reconciliation', 'human_review', 'resolved')"
    );
    expect(migration).toContain(
      "klyx_record_financial_reconciliation_decision"
    );
    expect(migration).toContain(
      "immutable_reconciliation_event_key_conflict"
    );
    expect(migration).toContain(
      "KLYX_FINANCIAL_RECONCILIATION_CONFLICT_NOT_WRITABLE"
    );
    expect(migration).not.toContain(
      "raise exception 'KLYX_FINANCIAL_RECONCILIATION_EVENT_CONFLICT'"
    );
    expect(migration).toContain(
      "'human_review',\n    'immutable_reconciliation_event_key_conflict',\n    'system'"
    );
    expect(server).toContain("openFinancialReconciliationCase");
    expect(server).toContain("recordFinancialReconciliationDecision");
    expect(server).toContain(
      'from("financial_reconciliation_events")'
    );
    expect(server).toContain(
      "KLYX_FINANCIAL_RECONCILIATION_EVENT_CONFLICT"
    );
  });

  it("mirrors certified platform-held group/split truth without inventing booking allocations", () => {
    for (const table of [
      "platform_held_group_settlements",
      "platform_held_group_settlement_members",
      "platform_held_group_refunds",
      "platform_held_group_refund_allocations",
      "platform_held_group_member_reversals",
    ]) {
      expect(groupSplitMigration).toContain(table);
    }

    expect(groupSplitMigration).toContain(
      "klyx_group_member_booking_economics"
    );
    expect(groupSplitMigration).toContain(
      "klyx_group_member_amount_allocations"
    );
    expect(groupSplitMigration).toContain(
      "klyx_group_member_provider_allocations"
    );
    expect(groupSplitMigration).toContain(
      "klyx_group_refund_booking_allocations"
    );
    expect(groupSplitMigration).toContain(
      "klyx_group_reversal_booking_allocations"
    );
    expect(groupSplitMigration).toContain(
      "v_prior_gross + v_allocation.gross_refund_cents"
    );
    expect(groupSplitMigration).toContain(
      "v_prior_provider + v_reversal.amount_cents"
    );
    expect(groupSplitMigration).toContain(
      "group_member_booking_allocation_mismatch"
    );
    expect(groupSplitMigration).toContain(
      "group_member_provider_allocation_invalid"
    );
    expect(groupSplitMigration).toContain("'human_review'");
    expect(groupSplitMigration).toContain(
      "platform_held_group_parent_central_ledger_mirror"
    );
    expect(groupSplitMigration).toContain(
      "platform_held_group_member_central_ledger_mirror"
    );
    expect(groupSplitMigration).toContain(
      "platform_held_group_refund_central_ledger_mirror"
    );
    expect(groupSplitMigration).toContain(
      "platform_held_group_reversal_central_ledger_mirror"
    );

    expect(groupSplitMigration).not.toContain("stripe.transfers.create(");
    expect(groupSplitMigration).not.toContain(
      "stripe.transfers.createReversal("
    );
    expect(groupSplitMigration).not.toContain("stripe.refunds.create(");
    expect(groupSplitMigration).not.toContain("stripe.payouts.create(");
  });

  it("reconciles shared Stripe objects from the aggregate of booking allocations", () => {
    expect(reconciliation).toContain("loadStripeObjectAllocations");
    expect(reconciliation).toContain("sumAmounts");
    expect(reconciliation).toContain(
      "stripe_payment_intent_ledger_aggregate_mismatch"
    );
    expect(reconciliation).toContain(
      "stripe_transfer_ledger_aggregate_mismatch"
    );
    expect(reconciliation).toContain(
      "stripe_reversal_ledger_aggregate_mismatch"
    );
    expect(reconciliation).toContain(
      "stripe_refund_ledger_aggregate_mismatch"
    );
    expect(reconciliation).toContain(
      "stripe_payout_ledger_aggregate_mismatch"
    );
    expect(reconciliation).toContain(
      "group_settlement_transfer_booking_allocation_mismatch"
    );
    expect(reconciliation).toContain(
      "group_settlement_reversal_booking_allocation_mismatch"
    );

    expect(reconciliation).not.toContain(
      "payout.amount !== payoutRow.amount_minor"
    );
    expect(reconciliation).not.toContain(
      "refund.amount !== refundRow.amount_minor"
    );
  });

  it("supports payout observations without creating payouts", () => {
    expect(server).toContain("recordObservedStripePayout");
    expect(server).toContain('movementType: "payout"');
    expect(server).toContain('source: "payout_observation"');
    expect(server).toContain("previousState?: string | null");
    expect(server).toContain("previousState: input.previousState ?? null");
    expect(server).not.toContain("stripe.payouts.create(");
    expect(server).not.toContain("stripe.transfers.create(");
    expect(server).not.toContain("stripe.refunds.create(");
  });

  it("reconciles KLYX ledger, Stripe and Settlement in read-only Stripe mode", () => {
    expect(reconciliation).toContain("reconcileCentralFinancialTruth");
    expect(reconciliation).toContain('from("financial_ledger_current")');
    expect(reconciliation).toContain('from("booking_settlements")');
    expect(reconciliation).toContain("stripe.paymentIntents.retrieve(");
    expect(reconciliation).toContain("stripe.transfers.retrieve(");
    expect(reconciliation).toContain("stripe.transfers.listReversals(");
    expect(reconciliation).toContain("stripe.refunds.retrieve(");
    expect(reconciliation).toContain("stripe.payouts.retrieve(");
    expect(reconciliation).toContain("openFinancialReconciliationCase");

    expect(reconciliation).not.toContain("stripe.transfers.create(");
    expect(reconciliation).not.toContain("stripe.transfers.createReversal(");
    expect(reconciliation).not.toContain("stripe.refunds.create(");
    expect(reconciliation).not.toContain("stripe.payouts.create(");
    expect(reconciliation).not.toContain('.from("bookings").update(');
    expect(reconciliation).not.toContain(
      '.from("booking_settlements").update('
    );
  });

  it("exposes reconciliation only behind an independent fail-closed ops secret", () => {
    expect(ops).toContain("KLYX_FINANCIAL_RECONCILIATION_SECRET");
    expect(ops).toContain("timingSafeEqual");
    expect(ops).toContain("KLYX_FINANCIAL_RECONCILIATION_NOT_CONFIGURED");
    expect(ops).toContain("KLYX_FINANCIAL_RECONCILIATION_UNAUTHORIZED");
    expect(ops).toContain('correctionMode: "no_silent_correction"');
    expect(ops).toContain("reconcileCentralFinancialTruth");
  });

  it("keeps browser roles outside the financial authority tables", () => {
    expect(migration).toContain(
      "revoke all privileges on table public.financial_ledger_events"
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role"
    );
    expect(migration).toContain(
      "grant select on table public.financial_ledger_events to service_role"
    );
    expect(migration).not.toContain(
      "grant insert on table public.financial_ledger_events to authenticated"
    );
  });
});
