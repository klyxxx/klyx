import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "lib/stripe-group-refunds.ts"),
  "utf8"
);

describe("group refund aggregate reconciliation contract", () => {
  it("persists each Stripe refund idempotently before aggregating partial refunds", () => {
    expect(source).toContain("persistSucceededRefundLedger");
    expect(source).toContain("aggregateSucceededRefunds");
    expect(source).toContain("group-refund:${params.refund.id}");
    expect(source).toContain('entryType: "refund_succeeded"');
    expect(source).toContain('status: "succeeded"');
  });

  it("only marks the group refunded when cumulative succeeded refunds equal the group total", () => {
    expect(source).toContain("const fullyRefunded = succeededAmount === total");
    expect(source).toContain('if (fullyRefunded) state = "refunded"');
    expect(source).toContain('payment_status: "refunded"');
    expect(source).toContain("finalizeRefundedGroup");
  });

  it("keeps partial refunds monotone and rejects impossible over-refunds", () => {
    expect(source).toContain("hasSucceededPartial");
    expect(source).toContain('state = "review_required"');
    expect(source).toContain("KLYX_GROUP_REFUND_AGGREGATE_EXCEEDS_TOTAL");
    expect(source).toContain('group.refund_status === "refunded"');
  });

  it("keeps legacy NULL refund states eligible for reconciliation", () => {
    expect(source).toContain(
      '.or("refund_status.is.null,refund_status.neq.refunded")'
    );
  });

  it("does not let a refund from an older PaymentIntent mutate the current group", () => {
    expect(source).toContain("group.stripe_payment_intent_id !== incomingIntentId");
    expect(source).toContain('query = query.eq("stripe_payment_intent_id", intentId)');
  });
});
