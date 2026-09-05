import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const wrapper = readFileSync(
  join(process.cwd(), "lib/split-stripe-payments.ts"),
  "utf8"
);

const core = readFileSync(
  join(process.cwd(), "lib/split-stripe-payments-core.ts"),
  "utf8"
);

describe("split payment stale failure guard", () => {
  it("fails closed when Stripe cannot correlate a failed PaymentIntent to an active Checkout Session", () => {
    expect(wrapper).toContain(
      'event.type === "payment_intent.payment_failed"'
    );
    expect(wrapper).toContain(
      'intent.metadata?.klyx_flow === "split_payment_13_27"'
    );
    expect(wrapper).toContain("if (!checkoutSessionId)");
    expect(wrapper).toContain("return false;");
  });

  it("requires the exact active split Checkout Session and no refund activity before delegating failure", () => {
    expect(wrapper).toContain(
      '.select("status, refund_status, stripe_checkout_session_id")'
    );
    expect(wrapper).toContain(
      "return data.stripe_checkout_session_id === checkoutSessionId;"
    );
    expect(wrapper).toContain(
      'if (data.status === "paid" || data.refund_status !== "none")'
    );
    expect(wrapper).toContain("if (!belongsToActiveCheckout)");
    expect(wrapper).toContain("return true;");
  });

  it("preserves the existing split Stripe engine behind the guard", () => {
    expect(wrapper).toContain(
      'from "@/lib/split-stripe-payments-core"'
    );
    expect(wrapper).toContain(
      "return handleSplitStripeWebhookEventCore(stripe, event);"
    );
    expect(core).toContain(
      "export async function handleSplitStripeWebhookEvent("
    );
    expect(core).toContain(
      "export async function reconcileSplitStripeRefund("
    );
  });
});
