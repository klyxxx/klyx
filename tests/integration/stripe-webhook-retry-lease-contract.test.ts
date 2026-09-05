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

  it("escalates repeated webhook retries without logging Stripe payloads", () => {
    const events = source("lib/stripe-webhook-events.ts");

    expect(events).toMatch(/logServerWarning/);
    expect(events).toMatch(/params\.attemptCount >= 3/);
    expect(events).toMatch(/stripe_webhook_retry_escalated/);
    expect(events).toMatch(/stripe_webhook_retry/);
    expect(events).toMatch(/requestId: params\.event\.id/);
    expect(events).toMatch(/code: params\.reason/);
    expect(events).not.toMatch(/JSON\.stringify\(\s*params\.event/);
  });

  it("fences processed and failed finalization with the winning attempt count", () => {
    const events = source("lib/stripe-webhook-events.ts");

    expect(events).toMatch(
      /markStripeWebhookProcessed\([\s\S]*\.eq\("status", "processing"\)[\s\S]*\.eq\("attempt_count", attemptCount\)/
    );
    expect(events).toMatch(
      /markStripeWebhookFailed\([\s\S]*\.eq\("status", "processing"\)[\s\S]*\.eq\("attempt_count", attemptCount\)/
    );
    expect(events).toMatch(
      /"recorded"[\s\S]*"superseded"[\s\S]*"record_failed"/
    );
    expect(events).toMatch(
      /return data[\s\S]*\? "recorded"[\s\S]*: "superseded"/
    );
  });

  it("threads the claim lease through the webhook route and acknowledges superseded workers", () => {
    const route = source("app/api/stripe/webhook/route.ts");

    expect(route).toMatch(/claim\.attemptCount/);
    expect(route).toMatch(
      /markStripeWebhookProcessed\(\s*event\.id,\s*attemptCount/
    );
    expect(route).toMatch(
      /markStripeWebhookFailed\(\s*event\.id,\s*claimAttemptCount,\s*"stripe_webhook_processing_failed"/
    );
    expect(route).toMatch(
      /failureMarkResult ===[\s\S]*"superseded"[\s\S]*return supersededClaimResponse/
    );
    expect(route).toMatch(/claim_superseded/);
  });

  it("replays the simple payment ledger after partial success", () => {
    const simple = source("lib/stripe-payments.ts");

    expect(simple).toMatch(
      /async function ensurePaymentSucceededLedger\([\s\S]*upsertFinancialLedgerEntry/
    );
    expect(simple).toMatch(
      /async function ensurePaymentSucceededSideEffects\([\s\S]*ensurePaymentSucceededLedger\([\s\S]*notifyPaymentSucceeded\(/
    );
    expect(simple).toMatch(
      /booking\.payment_status ===[\s\S]*"paid"[\s\S]*ensurePaymentSucceededSideEffects\(/
    );
  });

  it("keeps refunded simple payments terminal while repairing payment history", () => {
    const simple = source("lib/stripe-payments.ts");

    expect(simple).toMatch(
      /booking\.payment_status ===[\s\S]*"refunded"[\s\S]*ensurePaymentSucceededLedger\([\s\S]*return;/
    );
    expect(simple).toMatch(
      /refreshedBooking\.payment_status ===[\s\S]*"refunded"[\s\S]*ensurePaymentSucceededLedger\(/
    );
    expect(simple).toMatch(
      /\.neq\([\s\S]*"payment_status"[\s\S]*"paid"[\s\S]*\.neq\([\s\S]*"payment_status"[\s\S]*"refunded"/
    );
  });

  it("replays grouped ledgers without reviving refunded groups", () => {
    const group = source("lib/stripe-group-payments.ts");

    expect(group).toMatch(
      /async function upsertGroupPaymentLedgers\([\s\S]*upsertFinancialLedgerEntry/
    );
    expect(group).toMatch(
      /group\.payment_status ===[\s\S]*"refunded"[\s\S]*upsertGroupPaymentLedgers\([\s\S]*return;/
    );
    expect(group).toMatch(
      /\.from\("booking_groups"\)[\s\S]*\.neq\([\s\S]*"payment_status"[\s\S]*"paid"[\s\S]*\.neq\([\s\S]*"payment_status"[\s\S]*"refunded"[\s\S]*\.select\("id"\)[\s\S]*\.maybeSingle\(\)/
    );
    expect(group).toMatch(
      /\.from\("bookings"\)[\s\S]*\.neq\([\s\S]*"payment_status"[\s\S]*"paid"[\s\S]*\.neq\([\s\S]*"payment_status"[\s\S]*"refunded"/
    );
    expect(group).toMatch(
      /finalGroup\.payment_status ===[\s\S]*"refunded"[\s\S]*return;[\s\S]*Promise\.all\(/
    );
  });

  it("keeps refunded grouped payments terminal for late failure events", () => {
    const group = source("lib/stripe-group-payments.ts");

    expect(group).toMatch(
      /markBookingGroupFailedFromSession\([\s\S]*group\.payment_status ===[\s\S]*"paid"[\s\S]*group\.payment_status ===[\s\S]*"refunded"[\s\S]*return;/
    );
    expect(group).toMatch(
      /recordBookingGroupPaymentFailure\([\s\S]*group\.payment_status ===[\s\S]*"paid"[\s\S]*group\.payment_status ===[\s\S]*"refunded"[\s\S]*return;/
    );
  });

  it("repairs split run aggregation when a paid unit webhook is retried", () => {
    const split = source("lib/split-stripe-payments-core.ts");

    expect(split).toMatch(
      /if \([\s\S]*unit\.status ===[\s\S]*"paid"[\s\S]*\) \{[\s\S]*await refreshRunPaymentStatus\([\s\S]*unit\.run_id[\s\S]*\);[\s\S]*return;/
    );
  });
});
