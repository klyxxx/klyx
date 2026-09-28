import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260926200000_klyx_real_user_rpc_surface_hardening.sql"
  ),
  "utf8"
);

const internalFunctions = [
  "klyx_classify_market_request_price_band",
  "klyx_financial_live_authority_events_immutable",
  "klyx_financial_live_authority_guard",
  "klyx_guard_platform_held_booking_economics",
  "klyx_guard_platform_held_ledger_economics",
  "klyx_liquidity_booking_trigger",
  "klyx_liquidity_candidate_trigger",
  "klyx_liquidity_group_booking_trigger",
  "klyx_liquidity_incident_event_trigger",
  "klyx_liquidity_offer_trigger",
  "klyx_liquidity_request_trigger",
  "klyx_mark_platform_held_booking_paid",
  "klyx_mark_platform_held_refunded",
  "klyx_market_control_events_append_only_guard",
  "klyx_mirror_booking_financial_ledger_to_central",
  "klyx_mirror_booking_settlement_to_central",
  "klyx_reject_financial_audit_mutation",
  "klyx_reject_workflow_event_mutation",
] as const;

describe("KLYX real-user RPC surface hardening", () => {
  it("removes direct client execution from internal trigger and financial guards", () => {
    for (const fn of internalFunctions) {
      expect(migration).toContain(
        `revoke all on function public.${fn}()\n  from public, anon, authenticated;`
      );
      expect(migration).toContain(
        `grant execute on function public.${fn}()\n  to service_role;`
      );
    }
  });

  it("pins the remaining trigger search_path reported by Security Advisor", () => {
    expect(migration).toContain(
      "alter function public.klyx_reject_workflow_event_mutation()\n  set search_path = public, pg_temp;"
    );
  });

  it("does not activate LIVE or mutate financial authority", () => {
    expect(migration).not.toMatch(/update\s+public\.ops_financial_live_authority/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.ops_financial_live_authority/i);
    expect(migration).not.toContain("stripe.transfers");
    expect(migration).not.toContain("stripe.refunds");
    expect(migration).not.toContain("stripe.payouts");
  });
});
