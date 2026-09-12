import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912235000_klyx_trust_mission_enforcement.sql"
  ),
  "utf8"
);

describe("KLYX Trust & Safety mission enforcement", () => {
  it("binds a concrete booking to a versioned category/jurisdiction policy", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_mission_contexts"
    );
    expect(migration).toContain(
      "booking_id uuid not null references public.bookings(id) on delete cascade"
    );
    expect(migration).toContain("category_key text not null");
    expect(migration).toContain("jurisdiction_code text not null");
    expect(migration).toContain(
      "policy_id uuid not null references public.trust_category_policies(id) on delete restrict"
    );
    expect(migration).toContain(
      "constraint trust_mission_contexts_booking_key unique (booking_id)"
    );
  });

  it("supports controlled rollout instead of silently blocking all legacy bookings", () => {
    expect(migration).toContain(
      "enforcement_mode text not null default 'observe'"
    );
    expect(migration).toContain("enforcement_mode in ('observe', 'enforce')");
    expect(migration).toContain(
      "mission_context.enforcement_mode <> 'enforce'"
    );
  });

  it("guards the database transition into accepted, not just one API route", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_enforce_booking_trust_eligibility()"
    );
    expect(migration).toMatch(
      /create trigger klyx_bookings_enforce_trust_eligibility\s+before update of status\s+on public\.bookings/
    );
    expect(migration).toContain("new.status is distinct from 'accepted'");
    expect(migration).toContain("old.status is not distinct from 'accepted'");
  });

  it("maps the historical performer profile to the canonical account only as a compatibility adapter", () => {
    expect(migration).toContain(
      "performer_profile_id := coalesce(new.provider_id, new.babysitter_id)"
    );
    expect(migration).toContain("select profile.account_id");
    expect(migration).toContain("performer_account_id");
    expect(migration).toContain("KLYX_TRUST_ACCOUNT_REQUIRED");
  });

  it("requires a current decision for the exact account, policy, booking, category and jurisdiction", () => {
    expect(migration).toContain(
      "from public.trust_eligibility_decisions as decision"
    );
    expect(migration).toContain(
      "decision.account_id = performer_account_id"
    );
    expect(migration).toContain(
      "decision.policy_id = mission_context.policy_id"
    );
    expect(migration).toContain("decision.target_type = 'booking'");
    expect(migration).toContain("decision.target_ref = new.id::text");
    expect(migration).toContain(
      "decision.category_key = mission_context.category_key"
    );
    expect(migration).toContain(
      "decision.jurisdiction_code = mission_context.jurisdiction_code"
    );
    expect(migration).toContain(
      "decision.expires_at is null"
    );
    expect(migration).toContain("decision.expires_at > now()");
  });

  it("does not permit pending human review to masquerade as an allowed decision", () => {
    expect(migration).toContain(
      "decision.decision in ('eligible', 'eligible_with_conditions')"
    );
    expect(migration).toMatch(
      /decision\.human_review_required = false[\s\S]*or decision\.review_status = 'approved'/
    );
  });

  it("fails closed with a stable machine-readable database error when eligibility is absent", () => {
    expect(migration).toContain("KLYX_TRUST_PERFORMER_REQUIRED");
    expect(migration).toContain("KLYX_TRUST_ACCOUNT_REQUIRED");
    expect(migration).toContain("KLYX_TRUST_ELIGIBILITY_REQUIRED");
    expect(migration).toContain("errcode = '23514'");
  });

  it("keeps the mission-policy binding server-only", () => {
    expect(migration).toContain(
      "alter table public.trust_mission_contexts enable row level security"
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.trust_mission_contexts\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant all privileges on table public\.trust_mission_contexts\s+to service_role;/
    );
  });
});
