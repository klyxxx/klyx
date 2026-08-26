import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("KLYX Stripe webhook retry lease contract", () => {
  it("reclaims failed or stale webhook events with an optimistic compare-and-swap", () => {
    const events = source("lib/stripe-webhook-events.ts");

    expect(events).toMatch(/\.eq\("stripe_event_id", event\.id\)/);
    expect(events).toMatch(/\.eq\("status", stored\.status\)/);
    expect(events).toMatch(/\.eq\("attempt_count", stored\.attempt_count\)/);
    expect(events).toMatch(/\.eq\("updated_at", stored\.updated_at\)/);
    expect(events).toMatch(/\.select\("stripe_event_id, attempt_count"\)/);
    expect(events).toMatch(/retry_claim_lost/);
  });

  it("fences processed and failed finalization with the winning attempt count", () => {
    const events = source("lib/stripe-webhook-events.ts");

    expect(events).toMatch(
      /markStripeWebhookProcessed\([\s\S]*\.eq\("status", "processing"\)[\s\S]*\.eq\("attempt_count", attemptCount\)/
    );
    expect(events).toMatch(
      /markStripeWebhookFailed\([\s\S]*\.eq\("status", "processing"\)[\s\S]*\.eq\("attempt_count", attemptCount\)/
    );
  });

  it("threads the claim lease through the webhook route and handles superseded workers", () => {
    const route = source("app/api/stripe/webhook/route.ts");

    expect(route).toMatch(/claim\.attemptCount/);
    expect(route).toMatch(/markStripeWebhookProcessed\(\s*event\.id,\s*attemptCount/);
    expect(route).toMatch(
      /markStripeWebhookFailed\(\s*event\.id,\s*claimAttemptCount,\s*"stripe_webhook_processing_failed"/
    );
    expect(route).toMatch(/claim_superseded/);
  });
});
