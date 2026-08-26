import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("KLYX Stripe webhook retry lease contract", () => {
  it("keeps the durable webhook schema compatible with retry leasing", () => {
    const schema = source("supabase/step-8-0-stripe-webhook-events.sql");
    const canonicalBaseline = source(
      "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
    );
    const privilegeHardening = source(
      "supabase/migrations/20260819181000_klyx_server_audit_table_privileges.sql"
    );

    expect(schema).toMatch(/stripe_event_id text not null unique/);
    expect(schema).toMatch(/status text not null default 'processing'/);
    expect(schema).toMatch(
      /check \(status in \('processing', 'processed', 'failed'\)\)/
    );
    expect(schema).toMatch(/attempt_count integer not null default 1/);
    expect(schema).toMatch(/check \(attempt_count >= 1\)/);
    expect(schema).toMatch(/updated_at timestamptz not null default now\(\)/);
    expect(schema).toMatch(/enable row level security/);

    expect(canonicalBaseline).toMatch(
      /ADD CONSTRAINT "booking_financial_ledger_entry_key_key" UNIQUE \("entry_key"\)/
    );

    expect(privilegeHardening).toMatch(
      /revoke all privileges on table public\.stripe_webhook_events[\s\S]*from public, anon, authenticated/
    );
    expect(privilegeHardening).toMatch(
      /grant all privileges on table public\.stripe_webhook_events to service_role/
    );
  });

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

  it("replays simple booking payment ledger effects after a partial success", () => {
    const simple = source("lib/stripe-payments.ts");

    expect(simple).toMatch(
      /async function ensurePaymentSucceededSideEffects\([\s\S]*upsertFinancialLedgerEntry/
    );
    expect(simple).toMatch(
      /if \(booking\.payment_status === "paid"\) \{[\s\S]*ensurePaymentSucceededSideEffects\(/
    );
    expect(simple).toMatch(
      /refreshedBooking\.payment_status ===[\s\S]*"paid"[\s\S]*ensurePaymentSucceededSideEffects\(/
    );
  });

  it("always replays grouped payment ledger upserts and surfaces parent update errors", () => {
    const group = source("lib/stripe-group-payments.ts");

    expect(group).not.toMatch(/data:\s*updated/);
    expect(group).not.toMatch(/if \(updated\) \{[\s\S]*upsertFinancialLedgerEntry/);
    expect(group).toMatch(
      /\.from\("booking_groups"\)[\s\S]*\.neq\([\s\S]*"payment_status"[\s\S]*"paid"[\s\S]*if \(error\) \{[\s\S]*throw new Error/
    );
    expect(group).toMatch(/upsertFinancialLedgerEntry\(/);
  });

  it("repairs split run aggregation when a paid unit webhook is retried", () => {
    const split = source("lib/split-stripe-payments.ts");

    expect(split).toMatch(
      /if \([\s\S]*unit\.status ===[\s\S]*"paid"[\s\S]*\) \{[\s\S]*await refreshRunPaymentStatus\([\s\S]*unit\.run_id[\s\S]*\);[\s\S]*return;/
    );
  });
});
