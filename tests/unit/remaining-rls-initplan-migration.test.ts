import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260906081500_klyx_remaining_rls_initplan_optimization.sql"
  ),
  "utf8"
);

const normalized = migration.toLowerCase();

const targetPolicies = [
  "Clients read own memory profile",
  "Providers read own assistant drafts",
  "Clients read own quotes",
  "Providers read own quotes",
  "Participants read own disputes",
  "Participants read dispute events",
  "Profiles read own risk assessment",
  "Profiles read own security alerts",
  "Clients read own agent plans",
  "Providers read own verification",
  "Providers read own verification documents",
] as const;

describe("remaining RLS auth initplan migration", () => {
  it("alters exactly the eleven live advisor policies", () => {
    expect(normalized.match(/alter policy /g)).toHaveLength(11);

    for (const policy of targetPolicies) {
      expect(migration).toContain(`alter policy "${policy}"`);
    }
  });

  it("wraps every remaining auth.uid access in a scalar select", () => {
    expect(normalized.match(/\(select auth\.uid\(\)\)/g)).toHaveLength(13);
    expect(normalized).toContain("klyx_remaining_rls_initplan_policy_metadata_drift");
    expect(normalized).toContain("klyx_remaining_rls_initplan_semantics_drift");
  });

  it("preserves the client/provider and dispute authorization boundaries", () => {
    expect(normalized).toContain("client_profile_id");
    expect(normalized).toContain("provider_profile_id");
    expect(normalized).toContain("account_type = 'client'::text");
    expect(normalized).toContain("account_type = 'provider'::text");
    expect(normalized).toContain("opened_by");
    expect(normalized).toContain("against_profile_id");
    expect(normalized).toContain("dispute_events.dispute_id");
  });

  it("does not broaden scope into policy recreation or unrelated database work", () => {
    expect(normalized).not.toContain("drop policy");
    expect(normalized).not.toContain("create policy");
    expect(normalized).not.toContain("create index");
    expect(normalized).not.toContain("drop index");
    expect(normalized).not.toContain("stripe");
    expect(normalized).not.toContain("klyx_claim_booking_payment");
    expect(normalized).not.toContain("klyx_claim_booking_group_payment");
  });
});
