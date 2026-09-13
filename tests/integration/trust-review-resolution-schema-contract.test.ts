import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260913003000_klyx_trust_review_resolution_rpc.sql"
  ),
  "utf8"
);

describe("KLYX Trust & Safety human review resolution", () => {
  it("resolves reviews atomically in the database", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_resolve_trust_decision_review("
    );
    expect(migration).toContain("for update;");
    expect(migration).toContain("KLYX_TRUST_REVIEW_ALREADY_RESOLVED");
  });

  it("appends a replacement eligibility decision instead of overwriting history", () => {
    expect(migration).toContain(
      "insert into public.trust_eligibility_decisions ("
    );
    expect(migration).toContain("supersedes_id");
    expect(migration).toContain("decision_row.id");
    expect(migration).toContain("'human'");
  });

  it("copies only review references into the new input snapshot", () => {
    expect(migration).toContain(
      "'review_of_decision_id', decision_row.id"
    );
    expect(migration).toContain("'review_id', review_row.id");
    expect(migration).not.toContain("decision_row.input_snapshot");
  });

  it("records reviewer attribution, rationale and an unambiguous outcome id", () => {
    expect(migration).toContain(
      "reviewer_auth_user_id = p_reviewer_auth_user_id"
    );
    expect(migration).toContain("rationale = trim(p_rationale)");
    expect(migration).toContain(
      "outcome_decision_id = v_outcome_decision_id"
    );
    expect(migration).toContain("completed_at = now()");
  });

  it("does not turn an expired reviewed decision into a fresh indefinite permission", () => {
    expect(migration).toContain("KLYX_TRUST_DECISION_EXPIRED");
    expect(migration).toContain(
      "decision_row.expires_at is not null"
    );
    expect(migration).toContain("decision_row.expires_at <= now()");
    expect(migration).toContain("decision_row.expires_at");
  });

  it("keeps the review RPC inaccessible to browser roles", () => {
    expect(migration).toMatch(
      /revoke all on function public\.klyx_resolve_trust_decision_review\([\s\S]*\) from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant execute on function public\.klyx_resolve_trust_decision_review\([\s\S]*\) to service_role;/
    );
  });
});
