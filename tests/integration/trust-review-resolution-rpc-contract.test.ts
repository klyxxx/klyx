import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260913003000_klyx_trust_review_resolution_rpc.sql"
  ),
  "utf8"
);

describe("KLYX trust review RPC safety invariants", () => {
  it("requires an explicit reviewer and rationale", () => {
    expect(sql).toContain("KLYX_TRUST_REVIEWER_REQUIRED");
    expect(sql).toContain("KLYX_TRUST_REVIEW_RATIONALE_REQUIRED");
  });

  it("allows only explicit review resolution actions", () => {
    expect(sql).toContain("p_action not in ('uphold', 'replace')");
    expect(sql).toContain("KLYX_TRUST_REVIEW_ACTION_INVALID");
  });

  it("never rewrites the original decision payload on replacement", () => {
    expect(sql).toContain("insert into public.trust_eligibility_decisions");
    expect(sql).toContain("supersedes_id");
    expect(sql).not.toContain("set decision = p_replacement_decision");
    expect(sql).not.toContain("set explanation = trim(p_explanation)");
  });

  it("remains callable only by service_role", () => {
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
