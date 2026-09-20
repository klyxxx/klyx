import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX canonical financial ledger", () => {
  const migration = read(
    "supabase/migrations/20260920113000_klyx_canonical_financial_ledger.sql"
  );
  const writer = read("lib/canonical-financial-ledger.ts");
  const reconciler = read("lib/canonical-financial-reconciliation.ts");
  const legacyBridge = read("lib/payment-ledger.ts");
  const singleSettlement = read("lib/booking-settlement-server.ts");
  const groupSettlement = read("lib/platform-held-group-settlement-server.ts");

  it("defines one canonical append-only movement model", () => {
    expect(migration).toContain("create table if not exists public.financial_ledger_entries");
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

    expect(migration).toContain("amount_cents bigint not null");
    expect(migration).toContain("currency text not null");
    expect(migration).toContain("booking_id uuid");
    expect(migration).toContain("booking_ids jsonb");
    expect(migration).toContain("beneficiary_account_id uuid");
    expect(migration).toContain("cause text not null");
    expect(migration).toContain("previous_state text");
    expect(migration).toContain("new_state text");
    expect(migration).toContain("stripe_payment_intent_id text");
    expect(migration).toContain("stripe_charge_id text");
    expect(migration).toContain("stripe_transfer_id text");
    expect(migration).toContain("stripe_transfer_reversal_id text");
    expect(migration).toContain("stripe_refund_id text");
    expect(migration).toContain("stripe_payout_id text");
    expect(migration).toContain("occurred_at timestamptz not null");
  });

  it("is immutable and tamper-evident instead of upsert-based", () => {
    expect(migration).toContain("financial_ledger_entries_immutable");
    expect(migration).toContain("before update or delete on public.financial_ledger_entries");
    expect(migration).toContain("KLYX_CANONICAL_LEDGER_IMMUTABLE");
    expect(migration).toContain("previous_entry_hash text");
    expect(migration).toContain("entry_hash text not null unique");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("digest(");
    expect(migration).toContain("'sha256'");
    expect(migration).toContain("KLYX_LEDGER_EVENT_KEY_CONFLICT");
    expect(migration).not.toMatch(/update public\.financial_ledger_entries/i);
    expect(migration).not.toMatch(/delete from public\.financial_ledger_entries/i);
  });

  it("keeps direct table writes server-guarded", () => {
    expect(migration).toContain(
      "revoke all privileges on table public.financial_ledger_entries"
    );
    expect(migration).toContain(
      "grant select on table public.financial_ledger_entries to service_role"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_append_financial_ledger_entry"
    );
    expect(migration).not.toContain(
      "grant insert on table public.financial_ledger_entries"
    );
    expect(migration).not.toContain(
      "grant update on table public.financial_ledger_entries"
    );
    expect(migration).not.toContain(
      "grant delete on table public.financial_ledger_entries"
    );
  });

  it("explicitly demotes the old booking ledger to legacy compatibility", () => {
    expect(migration).toContain("LEGACY compatibility journal");
    expect(migration).toContain("Non-authoritative");
    expect(writer).not.toContain('from("booking_financial_ledger")');
  });

  it("turns divergence into reconciliation and human review, never silent correction", () => {
    expect(migration).toContain("financial_reconciliation_cases");
    expect(migration).toContain("financial_reconciliation_events");
    expect(migration).toContain(
      "status in ('reconciliation', 'human_review', 'resolved')"
    );
    expect(reconciler).toContain("openFinancialReconciliationCase");
    expect(reconciler).toContain('newStatus: "reconciliation"');
    expect(reconciler).toContain('newStatus: "human_review"');
    expect(reconciler).toContain("automaticCorrectionPerformed: false");

    expect(reconciler).not.toContain("stripe.transfers.create(");
    expect(reconciler).not.toContain("stripe.transfers.createReversal(");
    expect(reconciler).not.toContain("stripe.refunds.create(");
    expect(reconciler).not.toContain("stripe.payouts.create(");
    expect(reconciler).not.toMatch(
      /from\("financial_ledger_entries"\)[\s\S]*\.update\(/
    );
    expect(reconciler).not.toMatch(
      /from\("booking_settlements"\)[\s\S]*\.update\(/
    );
  });

  it("bridges only successful legacy money facts into the canonical ledger", () => {
    expect(legacyBridge).toContain("recordCanonicalPaymentFromLegacyLedger");
    expect(legacyBridge).toContain("recordCanonicalRefundFromLegacyLedger");
    expect(legacyBridge).toContain(
      'entry.entryType === "payment_succeeded" && entry.status === "succeeded"'
    );
    expect(legacyBridge).toContain(
      'entry.entryType === "refund_succeeded" && entry.status === "succeeded"'
    );
    expect(legacyBridge).not.toContain(
      'entry.entryType === "payment_failed" &&'
    );
    expect(legacyBridge).not.toContain(
      'entry.entryType === "refund_failed" &&'
    );
  });

  it("records Stripe movement truth before local settlement finalization", () => {
    const singleTransferLedger = singleSettlement.indexOf(
      "await recordCanonicalTransfer({"
    );
    const singleFinalize = singleSettlement.indexOf(
      "await finalizeRelease({",
      singleTransferLedger
    );
    expect(singleTransferLedger).toBeGreaterThan(-1);
    expect(singleFinalize).toBeGreaterThan(singleTransferLedger);

    const singleReversalLedger = singleSettlement.indexOf(
      "await recordCanonicalReversal({"
    );
    const singleReversalFinalize = singleSettlement.indexOf(
      "await finalizeReversal({",
      singleReversalLedger
    );
    expect(singleReversalLedger).toBeGreaterThan(-1);
    expect(singleReversalFinalize).toBeGreaterThan(singleReversalLedger);

    const groupTransferLedger = groupSettlement.indexOf(
      "await recordCanonicalAggregateTransfer({"
    );
    const groupFinalize = groupSettlement.indexOf(
      '"klyx_finalize_platform_held_group_member_release"',
      groupTransferLedger
    );
    expect(groupTransferLedger).toBeGreaterThan(-1);
    expect(groupFinalize).toBeGreaterThan(groupTransferLedger);

    const groupReversalLedger = groupSettlement.indexOf(
      "await recordCanonicalAggregateReversal({"
    );
    const groupReversalFinalize = groupSettlement.indexOf(
      '"klyx_finalize_platform_held_group_member_reversal"',
      groupReversalLedger
    );
    expect(groupReversalLedger).toBeGreaterThan(-1);
    expect(groupReversalFinalize).toBeGreaterThan(groupReversalLedger);
  });

  it("supports payout accounting only as observed booking allocation", () => {
    expect(writer).toContain("recordCanonicalPayoutAllocation");
    expect(writer).toContain('movementType: "payout"');
    expect(writer).toContain("stripePayoutId: input.payoutId");
    expect(writer).toContain("bookingId: input.bookingId");
    expect(writer).not.toContain("stripe.payouts.create(");
  });

  it("reconciles Ledger KLYX with Stripe and Settlement read-only", () => {
    expect(reconciler).toContain('from("financial_ledger_entries")');
    expect(reconciler).toContain('from("booking_settlements")');
    expect(reconciler).toContain("stripe.paymentIntents.retrieve");
    expect(reconciler).toContain("stripe.transfers.retrieve");
    expect(reconciler).toContain("stripe.transfers.listReversals");
    expect(reconciler).toContain("stripe.refunds.retrieve");
    expect(reconciler).toContain("stripe.payouts.retrieve");
    expect(reconciler).toContain("ledger_charge_divergence");
    expect(reconciler).toContain("ledger_commission_divergence");
    expect(reconciler).toContain("ledger_provider_liability_divergence");
    expect(reconciler).toContain("ledger_transfer_missing");
    expect(reconciler).toContain("ledger_reversal_missing");
    expect(reconciler).toContain("ledger_refund_amount_divergence");
    expect(reconciler).toContain("ledger_payout_overallocation");
  });
});
