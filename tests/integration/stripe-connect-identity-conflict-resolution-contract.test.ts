import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260923150000_klyx_stripe_connect_identity_conflict_resolution.sql",
  "utf8"
).replace(/\r\n/g, "\n");

describe("KLYX Stripe Connect identity conflict resolution", () => {
  it("is service-role-only and append-only audited", () => {
    expect(migration).toContain(
      "create table if not exists public.account_stripe_connect_identity_resolutions"
    );
    expect(migration).toContain(
      "create or replace function public.klyx_resolve_stripe_connect_identity_conflict"
    );
    expect(migration).toContain(
      "revoke all on function public.klyx_resolve_stripe_connect_identity_conflict"
    );
    expect(migration).toContain("to service_role");
    expect(migration).toContain("insert into public.account_stripe_connect_identity_resolutions");
    expect(migration).not.toContain("delete from public.account_stripe_connect_identity_resolutions");
  });

  it("requires the exact conflict set and historical evidence before selecting a winner", () => {
    expect(migration).toContain(
      "KLYX_CONNECT_IDENTITY_RESOLUTION_CONFLICT_SET_DRIFT"
    );
    expect(migration).toContain(
      "KLYX_CONNECT_IDENTITY_RESOLUTION_HISTORY_DRIFT"
    );
    expect(migration).toContain(
      "KLYX_CONNECT_IDENTITY_RESOLUTION_SELECTED_NOT_HISTORICAL"
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("v_current_conflicts is distinct from v_expected");
    expect(migration).toContain("v_historical_ids is distinct from v_expected");
  });

  it("never reassigns an obsolete legacy profile to the selected Stripe account", () => {
    expect(migration).toContain("set stripe_account_id = null");
    expect(migration).toContain("stripe_onboarding_complete = false");
    expect(migration).toContain("stripe_charges_enabled = false");
    expect(migration).toContain("stripe_payouts_enabled = false");
    expect(migration).not.toContain("set stripe_account_id = v_selected");
  });

  it("prevents the selected Stripe account from belonging to another KLYX account", () => {
    expect(migration).toContain(
      "KLYX_CONNECT_IDENTITY_RESOLUTION_SELECTED_ALREADY_CANONICAL"
    );
    expect(migration).toContain(
      "KLYX_CONNECT_IDENTITY_RESOLUTION_SELECTED_OTHER_ACCOUNT_HISTORY"
    );
  });

  it("changes only identity projections and never rewrites financial history", () => {
    for (const forbidden of [
      "booking_financial_ledger",
      "financial_ledger_entries",
      "booking_settlements",
      "stripe_transfers",
      "refunds",
      "payment_intents",
    ]) {
      expect(migration).not.toMatch(
        new RegExp(`(?:update|delete\\s+from|insert\\s+into)\\s+public\\.${forbidden}`, "i")
      );
    }
  });

  it("links the canonical account only after stale mirrors have been cleared", () => {
    const clearLegacy = migration.indexOf("set stripe_account_id = null");
    const linkCanonical = migration.indexOf("identity_state = 'linked'");
    const audit = migration.indexOf(
      "insert into public.account_stripe_connect_identity_resolutions"
    );

    expect(clearLegacy).toBeGreaterThan(-1);
    expect(linkCanonical).toBeGreaterThan(clearLegacy);
    expect(audit).toBeGreaterThan(linkCanonical);
  });
});
