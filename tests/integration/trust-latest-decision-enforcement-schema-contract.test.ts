import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260913004000_klyx_trust_latest_decision_enforcement.sql"
  ),
  "utf8"
);

describe("KLYX latest Trust & Safety decision enforcement", () => {
  it("loads the latest exact-scope booking decision before evaluating its outcome", () => {
    expect(migration).toContain(
      "select decision.*\n  into latest_decision"
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
      "order by decision.created_at desc, decision.id desc"
    );
  });

  it("does not filter to eligible outcomes before choosing the authoritative latest decision", () => {
    const selectStart = migration.indexOf("select decision.*");
    const selectEnd = migration.indexOf("limit 1;", selectStart);
    const selection = migration.slice(selectStart, selectEnd);

    expect(selection).not.toContain("decision.decision in");
    expect(selection).not.toContain("decision.expires_at > now()");
  });

  it("fails closed when the latest outcome is adverse, pending review, or expired", () => {
    expect(migration).toContain(
      "latest_decision.decision not in ('eligible', 'eligible_with_conditions')"
    );
    expect(migration).toContain(
      "latest_decision.review_status <> 'approved'"
    );
    expect(migration).toContain("latest_decision.expires_at <= now()");
    expect(migration).toContain("KLYX_TRUST_ELIGIBILITY_REQUIRED");
  });

  it("keeps the database gate service-role only", () => {
    expect(migration).toMatch(
      /revoke all on function public\.klyx_enforce_booking_trust_eligibility\(\)\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant execute on function public\.klyx_enforce_booking_trust_eligibility\(\)\s+to service_role;/
    );
  });
});
