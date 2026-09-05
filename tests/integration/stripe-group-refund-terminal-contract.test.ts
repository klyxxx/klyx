import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stripe group refund terminal contract", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/stripe-group-refunds.ts"),
    "utf8"
  );

  it("ignores refunds tied to an older PaymentIntent", () => {
    expect(source).toMatch(
      /group\.stripe_payment_intent_id[\s\S]*!==[\s\S]*incomingIntentId/
    );
    expect(source).toContain("return true;");
  });

  it("routes cumulative successful partial refunds to manual review", () => {
    expect(source).toContain(
      "const hasSucceededPartial = succeededAmount > 0 && !fullyRefunded;"
    );
    expect(source).toContain(
      'else if (hasSucceededPartial || group.refund_status === "review_required") state = "review_required";'
    );
    expect(source).not.toContain("KLYX refuse un remboursement partiel");
  });

  it("keeps review_required monotone against later non-terminal events", () => {
    expect(source).toContain('group.refund_status === "review_required"');
    expect(source).toContain(
      '.or("refund_status.is.null,refund_status.neq.refunded")'
    );
    expect(source).toContain('if (state !== "refunded")');
  });

  it("marks child bookings refunded only after a full cumulative group refund", () => {
    expect(source).toContain('if (fullyRefunded) state = "refunded"');
    expect(source).toContain("await finalizeRefundedGroup({ group, children, refund, now });");
    expect(source).toMatch(/payment_status:\s*"refunded"/);
    expect(source).toMatch(/refund_status:\s*"succeeded"/);
  });
});
