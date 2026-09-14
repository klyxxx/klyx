import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const limiter = source("lib/api-rate-limit.ts");
const authority = source("app/api/trust-safety/authority/route.ts");
const reports = source("app/api/trust-safety/reports/route.ts");
const review = source("app/api/trust-safety/review-request/route.ts");

describe("Trust & Safety durable rate limits", () => {
  it("defines dedicated policies instead of borrowing Stripe or AI quotas", () => {
    expect(limiter).toContain("trustSafetyDeclarationMutation");
    expect(limiter).toContain('action: "trust_safety_declaration_mutation"');
    expect(limiter).toContain("trustSafetyReportCreate");
    expect(limiter).toContain('action: "trust_safety_report_create"');
    expect(limiter).toContain("trustSafetyReviewRequest");
    expect(limiter).toContain('action: "trust_safety_review_request"');
  });

  it("consumes quota after authentication and before parsing each sensitive body", () => {
    for (const [route, policy] of [
      [authority, "trustSafetyDeclarationMutation"],
      [reports, "trustSafetyReportCreate"],
      [review, "trustSafetyReviewRequest"],
    ] as const) {
      const auth = route.indexOf("getAuthenticatedProfile(request)");
      const quota = route.indexOf(`API_RATE_LIMIT_POLICIES.${policy}`, auth);
      const body = route.indexOf("request.json()", quota);

      expect(auth).toBeGreaterThanOrEqual(0);
      expect(quota).toBeGreaterThan(auth);
      expect(body).toBeGreaterThan(quota);
      expect(route).toContain("consumeApiRateLimit(profile.id, ratePolicy)");
      expect(route).toContain("apiRateLimitExceededResponse(ratePolicy, rateLimit)");
    }
  });
});
