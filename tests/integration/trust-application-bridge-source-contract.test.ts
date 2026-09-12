import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const server = read("lib/trust-safety/server.ts");
const eligibilityRoute = read("app/api/trust/eligibility/route.ts");
const reviewRoute = read("app/api/trust/reviews/route.ts");
const adminRoute = read("app/api/admin/trust/reviews/route.ts");

describe("KLYX Trust & Safety application bridge", () => {
  it("resolves the canonical account from auth identity instead of provider role", () => {
    expect(server).toContain('.from("accounts")');
    expect(server).toContain('.eq("auth_user_id", auth.user.id)');
    expect(server).not.toContain("provider_profiles");
    expect(server).not.toContain("requireAccountType");
  });

  it("does not select sensitive decision snapshots in the user read path", () => {
    expect(server).not.toContain("input_snapshot");
    expect(server).not.toContain("evidence_ref");
    expect(eligibilityRoute).toContain("listTrustDecisions");
  });

  it("keeps review requests account-scoped and idempotent", () => {
    expect(server).toContain('.eq("account_id", params.accountId)');
    expect(server).toContain('.in("status", ["requested", "in_progress"])');
    expect(server).toContain('createError?.code === "23505"');
    expect(reviewRoute).toContain("requestTrustDecisionReview");
  });

  it("requires KLYX admin authorization for the human review queue", () => {
    expect(adminRoute).toContain("await requireKlyxAdmin()");
    expect(adminRoute).toContain("const reviewer = await requireKlyxAdmin()");
    expect(adminRoute).toContain('"klyx_resolve_trust_decision_review"');
  });

  it("does not activate mission enforcement from application routes", () => {
    expect(server).not.toContain("trust_mission_contexts");
    expect(eligibilityRoute).not.toContain("enforcement_mode");
    expect(reviewRoute).not.toContain("enforcement_mode");
    expect(adminRoute).not.toContain("enforcement_mode");
  });
});
