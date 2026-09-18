import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("canonical account risk engine contract", () => {
  it("aggregates risk across every profile owned by the authenticated account", () => {
    const source = read("lib/account-risk-server.ts");

    expect(source).toContain('.eq("owner_user_id", account.authUserId)');
    expect(source).toContain("profile.account_id !== account.id");
    expect(source).toContain("KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH");
    expect(source).toContain("bookingParticipantFilter(profileIds)");
    expect(source).toContain('.in("opened_by", profileIds)');
    expect(source).toContain('.in("against_profile_id", profileIds)');
    expect(source).not.toContain("profile_risk_assessments");
  });

  it("uses canonical Stripe Connect state instead of legacy profile readiness", () => {
    const source = read("lib/account-risk-server.ts");

    expect(source).toContain("getAccountStripeConnectIdentity(account.id)");
    expect(source).toContain('connect?.state === "linked"');
    expect(source).toContain('connect?.state === "conflict"');
    expect(source).not.toContain("stripe_onboarding_complete");
    expect(source).not.toContain("service_profiles");
  });

  it("stores new risk evidence in server-only account-level tables", () => {
    const migration = read(
      "supabase/migrations/20260915110000_klyx_account_risk_engine.sql"
    );

    expect(migration).toContain("create table if not exists public.account_risk_assessments");
    expect(migration).toContain("create table if not exists public.account_security_alerts");
    expect(migration).toContain("account_id uuid not null references public.accounts(id) on delete cascade");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("delete from public.profile_risk_assessments");
    expect(migration).not.toContain("delete from public.security_alerts");
  });

  it("escalates unresolved canonical financial identity ambiguity without automatic suspension", () => {
    const engine = read("lib/security-risk.ts");
    const route = read("app/api/security/risk/risk-route-core.ts");

    expect(engine).toContain("financialIdentityReviewRequired: boolean");
    expect(engine).toContain('code: "financial_identity_review_required"');
    expect(engine).toContain("points: 40");
    expect(route).toContain("automaticRestriction: false");
  });
});