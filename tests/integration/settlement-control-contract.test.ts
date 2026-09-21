import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("KLYX settlement control phase-1 contract", () => {
  it("separates LIVE code capability from explicit financial authorization", () => {
    const source = read("lib/stripe-settlement-control.ts");
    const liveGate = read("lib/live-financial-authorization-server.ts");

    expect(source).toContain("KLYX_SETTLEMENT_CONTROL_LIVE_NOT_READY");
    expect(source).toContain('secret.startsWith("sk_live_")');
    expect(source).toContain("KLYX_SETTLEMENT_CONTROL_TEST_READY");
    expect(source).toContain("KLYX_SETTLEMENT_CONTROL_LIVE_READY");
    expect(source).toContain("if (requested === KLYX_LEGACY_SETTLEMENT_MODE)");
    expect(liveGate).toContain("KLYX_LIVE_FINANCIAL_NOT_AUTHORIZED");
    expect(liveGate).toContain("certified_sha_matches_build");
    expect(liveGate).toContain("proof_durable_jobs_worker");
  });

  it("defines a server-only atomic settlement release plane", () => {
    const migration = compact(
      read(
        "supabase/migrations/20260915170000_klyx_booking_settlement_control.sql"
      )
    );

    expect(migration).toContain("create table if not exists public.booking_settlements");
    expect(migration).toContain("alter table public.booking_settlements enable row level security");
    expect(migration).toContain(
      "revoke all privileges on table public.booking_settlements from public, anon, authenticated"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_claim_booking_settlement_release"
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("status, payment_status, refund_status");
    expect(migration).toContain("coalesce(v_booking.status, '') <> 'completed'");
    expect(migration).toContain("coalesce(v_booking.payment_status, '') <> 'paid'");
    expect(migration).toContain("release_attempt_number = release_attempt_number + 1");
    expect(migration).toContain(
      "create or replace function public.klyx_finalize_booking_settlement_release"
    );
    expect(migration).toContain("release_claim_token = p_claim_token");
    expect(migration).toContain(
      "create or replace function public.klyx_fail_booking_settlement_release"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_mark_booking_settlement_refunded"
    );
  });

  it("does not silently change the currently certified checkout money flow", () => {
    const single = read("app/api/stripe/create-checkout-session/route-core.ts");
    const group = read("app/api/stripe/create-group-checkout-session/route-core.ts");
    const split = read(
      "app/api/bookings/split-missions/[id]/checkout/route-core.ts"
    );

    for (const source of [single, group, split]) {
      expect(source).toContain("transfer_data");
    }

    expect(single).toContain('paymentMode === "connect_destination"');
    expect(group).toContain('paymentMode === "connect_destination"');
    expect(split).toContain("application_fee_amount");
  });

  it("keeps transfer/payout side effects out of the settlement mode selector", () => {
    const control = read("lib/stripe-settlement-control.ts");
    const migration = read(
      "supabase/migrations/20260915170000_klyx_booking_settlement_control.sql"
    );
    const documentation = read("docs/KLYX_SETTLEMENT_CONTROL.md");

    expect(control).not.toContain("stripe.transfers.create");
    expect(control).not.toContain("stripe.payouts.create");
    expect(migration).not.toContain("stripe.transfers.create");
    expect(migration).not.toContain("stripe.payouts.create");
    expect(documentation).toContain("change Express payout schedules");
  });
});
