import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

describe("Single Platform-Held partial refund contract", () => {
  const migration = read(
    "supabase/migrations/20260922212200_klyx_single_platform_held_partial_refund.sql"
  );
  const server = read("lib/platform-held-booking-refund-server.ts");
  const route = read("app/api/bookings/[id]/refund/route.ts");
  const webhook = read("app/api/stripe/webhook/route.ts");
  const central = read("lib/financial-ledger-reconciliation-server.ts");
  const recovery = read("lib/booking-settlement-reconciliation-server.ts");
  const economics = read(
    "lib/group-multiexecutor-settlement-economics.ts"
  );

  it("creates one server-only Single refund/reversal authority", () => {
    expect(migration).toContain(
      "create table public.platform_held_booking_refunds"
    );
    expect(migration).toContain(
      "create table public.platform_held_booking_reversals"
    );
    expect(migration).toContain("unique (booking_id, request_key)");
    expect(migration).toContain(
      "alter table public.platform_held_booking_refunds enable row level security"
    );
    expect(migration).toContain(
      "alter table public.platform_held_booking_reversals enable row level security"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("keeps the first port post-Transfer and out of Group/Split authority", () => {
    expect(migration).toContain("v_settlement.state <> 'released'");
    expect(migration).toContain("v_booking.booking_group_id is not null");
    expect(server).toContain("booking.booking_group_id !== null");
    expect(server).toContain('settlement.state !== "released"');
    expect(server).not.toContain("platform_held_group_refunds");
    expect(server).not.toContain("split_booking_payment_units");
  });

  it("uses the same cumulative integer rounding rule as Group", () => {
    expect(economics).toContain(
      "export function calculateCumulativeRefundDelta"
    );
    expect(economics).toContain(
      "(fee * cumulativeGross + gross / BigInt(2)) / gross"
    );
    expect(economics).toContain("return calculateCumulativeRefundDelta");

    expect(migration).toContain(
      "Same exact integer rule as calculateCumulativeRefundDelta"
    );
    expect(migration).toContain(
      "+ floor(v_settlement.gross_amount_cents::numeric / 2)"
    );
  });

  it("freezes idempotent request-key economics and blocks concurrent plans", () => {
    expect(migration).toContain("KLYX_SINGLE_REFUND_REQUEST_KEY_CONFLICT");
    expect(migration).toContain("KLYX_SINGLE_REFUND_ALREADY_IN_FLIGHT");
    expect(migration).toContain("KLYX_SINGLE_REFUND_EXCEEDS_GROSS");
    expect(server).toContain("KLYX_SINGLE_REFUND_REQUEST_KEY_CONFLICT");
    expect(server).toContain("klyx-platform-held-booking-refund-");
    expect(server).toContain("klyx-platform-held-booking-reversal-");
    expect(server).toContain("refund.id");
  });

  it("reverses only the frozen provider delta before refunding the client", () => {
    expect(server).toContain(
      "amount: Number(input.refund.provider_refund_cents)"
    );
    expect(server).toContain(
      "klyx_finalize_platform_held_booking_reversal"
    );
    expect(migration).toContain(
      "v_refund.provider_refund_cents <> p_amount_cents"
    );
    expect(migration).toContain(
      "KLYX_SINGLE_REFUND_REVERSAL_EXCEEDS_TRANSFER"
    );
    expect(server.indexOf("processRequiredReversal")).toBeLessThan(
      server.indexOf("stripe.refunds.create")
    );
  });

  it("makes failure after provider reversal human-review, never silently failed", () => {
    expect(migration).toContain(
      "single_refund_failed_after_provider_reversal"
    );
    expect(migration).toContain("'human_review'");
    expect(migration).toContain("klyx_open_financial_reconciliation_case");
  });

  it("records every partial reversal in the canonical ledger and updates provider liability state", () => {
    expect(migration).toContain(
      "platform_held_booking_reversal_central_mirror"
    );
    expect(migration).toContain("'reversal'");
    expect(migration).toContain("'provider_liability'");
    expect(migration).toContain("'partially_reversed'");
    expect(migration).toContain("'reversed'");
    expect(migration).toContain(
      "klyx_financial_beneficiary_account_ref"
    );
  });

  it("keeps client refunds on the existing payment-ledger projection", () => {
    expect(server).toContain("reconcileStripeRefund(stripeRefund)");
    expect(migration).not.toContain(
      "single_settlement_refund_succeeded"
    );
  });

  it("requires central financial truth to be coherent before a new refund", () => {
    expect(route).toContain("reconcileCentralFinancialTruth");
    expect(route).toContain('financialTruth.status !== "coherent"');
    expect(route).toContain(
      "KLYX_FINANCIAL_RECONCILIATION_REQUIRED"
    );
    expect(server).toContain("enforceRefundTransactionRisk");
    expect(server).toContain('capability: "refunds"');
  });

  it("routes Stripe webhooks through frozen Single truth before compatibility projection", () => {
    const singleIndex = webhook.indexOf(
      "reconcilePlatformHeldBookingRefundFromStripe(refund)"
    );
    const projectionIndex = webhook.indexOf(
      "reconcileStripeRefund(refund)",
      singleIndex
    );

    expect(singleIndex).toBeGreaterThan(-1);
    expect(projectionIndex).toBeGreaterThan(singleIndex);
    expect(server).toContain("single_refund_webhook_truth_mismatch");
    expect(server).toContain(
      "KLYX_SINGLE_REFUND_WEBHOOK_LIVEMODE_MISMATCH"
    );
  });

  it("accepts many reversals/refunds only when terminal cents equal frozen Settlement truth", () => {
    expect(central).toContain("const succeededRefundAmount = refunds");
    expect(central).toContain("const reversalAmount = reversals.reduce");
    expect(central).toContain(
      "refunded_settlement_refund_total_mismatch"
    );
    expect(central).toContain(
      "refunded_settlement_reversal_total_mismatch"
    );

    expect(migration).toContain(
      "v_gross_total = v_settlement.gross_amount_cents"
    );
    expect(migration).toContain(
      "v_provider_total <> v_settlement.provider_amount_cents"
    );
    expect(migration).toContain(
      "v_reversal_total <> v_settlement.provider_amount_cents"
    );
  });

  it("prevents legacy one-refund recovery from touching child-plan truth", () => {
    expect(recovery).toContain("managedSingleRefundState");
    expect(recovery).toContain("single_refund_child_in_progress");
    expect(recovery).toContain(
      "single_refund_child_partial_succeeded"
    );
    expect(recovery).toContain(
      "single_refund_child_review_required"
    );
  });

  it("contains no LIVE activation or deployment side effect", () => {
    for (const source of [migration, server, route]) {
      expect(source).not.toContain("KLYX_LIVE_PAYMENTS_ENABLED=true");
      expect(source).not.toContain("vercel deploy");
      expect(source).not.toContain("supabase db push");
      expect(source).not.toContain("stripe.payouts.create");
    }
  });
});
