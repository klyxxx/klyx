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
    expect(migration).toContain("amount_cents bigint not null");
    expect(migration).toContain("currency text not null");
    expect(migration).toContain("booking_id uuid not null");
    expect(migration).toContain("beneficiary_kind text not null");
    expect(migration).toContain("beneficiary_ref text not null");
    expect(migration).toContain("previous_state text");
    expect(migration).toContain("new_state text not null");
    expect(migration).toContain("occurred_at timestamptz not null");
    expect(migration).toContain("payload_hash text not null");
    expect(migration).toContain("set search_path = public, extensions");
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
    expect(server).toContain("openFinancialReconciliationCase");
    expect(server).toContain("recordFinancialReconciliationDecision");
  });

  it("supports payout observations without creating payouts", () => {
    expect(server).toContain("recordObservedStripePayout");
    expect(server).toContain('movementType: "payout"');
    expect(server).toContain('source: "payout_observation"');
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
