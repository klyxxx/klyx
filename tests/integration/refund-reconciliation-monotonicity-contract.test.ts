import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260826193000_klyx_refund_reconciliation_monotonicity.sql"
);
const simpleRefunds = read("lib/stripe-refunds.ts");
const groupRefunds = read("lib/stripe-group-refunds.ts");
const webhookRoute = read("app/api/stripe/webhook/route.ts");

describe("KLYX refund reconciliation monotonicity", () => {
  it("gives grouped Stripe refund audit rows a deterministic database identity", () => {
    expect(migration).toMatch(
      /add\s+column\s+if\s+not\s+exists\s+stripe_refund_id\s+text/i
    );
    expect(migration).toMatch(
      /create\s+unique\s+index\s+if\s+not\s+exists\s+booking_group_cancellation_events_refund_identity_uidx[\s\S]*booking_group_id[\s\S]*action[\s\S]*stripe_refund_id/i
    );
    expect(groupRefunds).toMatch(
      /onConflict:\s*"booking_group_id,action,stripe_refund_id"/
    );
    expect(groupRefunds).toMatch(
      /stripe_refund_id:\s*params\.stripeRefundId/
    );
  });

  it("refuses stale grouped failure audit after a terminal refund", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_guard_group_refund_audit_16_11()"
    );
    expect(migration).toMatch(
      /new\.action\s*=\s*'refund_failed'[\s\S]*refund_status\s*=\s*'refunded'[\s\S]*return\s+null;/i
    );
    expect(groupRefunds).toContain("groupRefundIsTerminal");
    expect(groupRefunds).toContain('if (group.refund_status === "refunded") return true;');
    expect(groupRefunds).toContain("if (await groupRefundIsTerminal(group.id)) return true;");
    expect(groupRefunds).toContain('action: "refund_failed"');
  });

  it("keeps simple succeeded refund state terminal while accepting null legacy state", () => {
    expect(simpleRefunds).toMatch(
      /refundStatus\s*!==\s*"succeeded"[\s\S]*booking\.refund_status\s*===\s*"succeeded"/
    );
    expect(simpleRefunds).toContain(
      "refund_status.is.null,refund_status.neq.succeeded"
    );
    expect(simpleRefunds).toContain("bookingRefundSucceeded");
  });

  it("keeps grouped refunded state terminal while accepting null legacy state", () => {
    expect(groupRefunds).toContain('if (group.refund_status === "refunded") return true;');
    expect(groupRefunds).toContain(
      "refund_status.is.null,refund_status.neq.refunded"
    );
    expect(groupRefunds).toContain("groupRefundIsTerminal");
    expect(groupRefunds).toContain("KLYX_GROUP_REFUND_STATE_UPDATE_LOST");
  });

  it("prevents succeeded ledger and split refund rows from being downgraded", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_preserve_succeeded_financial_ledger_16_11()"
    );
    expect(migration).toMatch(
      /old\.status\s*=\s*'succeeded'[\s\S]*new\.status\s+is\s+distinct\s+from\s+'succeeded'[\s\S]*return\s+old;/i
    );
    expect(migration).toContain(
      "create or replace function public.klyx_preserve_succeeded_split_refund_16_11()"
    );
    expect(migration).toContain(
      "before update on public.split_booking_payment_refunds"
    );
  });

  it("keeps the new financial tables and functions server-only", () => {
    expect(migration).toMatch(
      /revoke\s+all\s+privileges\s+on\s+table\s+public\.booking_group_cancellation_events[\s\S]*from\s+public,\s*anon,\s*authenticated/i
    );
    expect(migration).toMatch(
      /revoke\s+all\s+privileges\s+on\s+table\s+public\.booking_financial_ledger[\s\S]*from\s+public,\s*anon,\s*authenticated/i
    );
    expect(migration).toMatch(
      /revoke\s+all\s+privileges\s+on\s+table\s+public\.split_booking_payment_refunds[\s\S]*from\s+public,\s*anon,\s*authenticated/i
    );
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.klyx_preserve_succeeded_financial_ledger_16_11\(\)[\s\S]*from\s+public,\s*anon,\s*authenticated/i
    );
  });

  it("continues to route every supported Stripe refund event family through reconciliation", () => {
    expect(webhookRoute).toContain('case "refund.created":');
    expect(webhookRoute).toContain('case "refund.updated":');
    expect(webhookRoute).toContain('case "refund.failed":');
    expect(webhookRoute).toContain('case "charge.refunded":');
    expect(webhookRoute).toMatch(
      /await\s+reconcileStripeRefund\(\s*refund\s*\)/
    );
  });
});
