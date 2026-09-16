import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const route = read("app/api/bookings/incidents/route.ts");
const replacement = read(
  "app/api/bookings/incidents/[id]/replacement/route.ts"
);
const migration = read(
  "supabase/migrations/20260914183000_klyx_account_post_booking_incidents.sql"
);
const policy = read("lib/post-booking-incidents.ts");

describe("KLYX account-first post-booking incident contract", () => {
  it("uses canonical account ownership and keeps legacy profiles as booking adapters", () => {
    expect(route).toContain("getAuthenticatedAccount");
    expect(route).toContain("auth.account.id");
    expect(migration).toContain("account_id uuid not null references public.accounts(id)");
    expect(migration).toContain("reporter_profile_id uuid references public.profiles(id)");
    expect(migration).toContain("account_id is the canonical owner");
  });

  it("reuses the existing provider-search and agent orchestration state", () => {
    expect(route).toContain("providerSearchCore");
    expect(route).toContain('.from("client_agent_plans")');
    expect(route).toContain('.from("client_agent_plan_events")');
    expect(route).toContain('next_action: "choose"');
    expect(route).toContain("replacement_requires_explicit_consent");
  });

  it("never replaces, books or charges automatically", () => {
    expect(replacement).toContain('body.action === "present_best"');
    expect(replacement).toContain('body.action === "select"');
    expect(replacement).toContain("explicitUserConsent: true");
    expect(replacement).toContain("automaticReplacement: false");
    expect(replacement).toContain("automaticBooking: false");
    expect(replacement).toContain("automaticCharge: false");
    expect(replacement).not.toContain('stripe.refunds.create');
    expect(replacement).not.toContain('.from("payment_intents")');
    expect(replacement).not.toContain('.from("trust_restrictions")');
  });

  it("connects sensitive incidents to Trust & Safety human review without an LLM verdict or sanction", () => {
    expect(route).toContain('.from("trust_cases")');
    expect(route).toContain('.from("trust_case_events")');
    expect(route).toContain('event_type: "review_requested"');
    expect(route).toContain("llm_decision: false");
    expect(route).toContain("automatic_sanction: false");
    expect(route).not.toContain('.from("trust_restrictions")');
    expect(policy).toContain("llmDecisionAllowed: false");
    expect(policy).toContain("automaticSanctionAllowed: false");
  });

  it("preserves reason, evidence and append-only incident decision history", () => {
    expect(migration).toContain("reason text not null");
    expect(migration).toContain("evidence jsonb not null");
    expect(migration).toContain("policy_snapshot jsonb not null");
    expect(migration).toContain("booking_incident_events");
    expect(migration).toContain("grant select, insert on table public.booking_incident_events to service_role");
    expect(migration).not.toContain("grant select, insert, update, delete on table public.booking_incident_events");
  });

  it("keeps refund and incident economics on the existing ledgers", () => {
    expect(route).toContain('ledger: "booking_financial_ledger"');
    expect(route).toContain("createsParallelLedger: false");
    expect(route).not.toContain('stripe.refunds.create');
    expect(migration).toContain("business_booking_incident_attribution");
    expect(migration).toContain("booking_financial_ledger");
    expect(migration).toContain("business_cost_events");
    expect(migration).toContain("No money is stored here");
  });
});
