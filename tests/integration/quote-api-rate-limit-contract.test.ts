import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const helper = readRepoFile("lib/api-rate-limit.ts");
const middleware = readRepoFile("lib/supabase/middleware.ts");
const goldenWorkflow = readRepoFile(".github/workflows/klyx-golden-path.yml");

describe("KLYX quote API rate limits", () => {
  it("defines conservative authenticated quote write policies", () => {
    expect(helper).toContain("quoteCreate");
    expect(helper).toContain('action: "quote_create"');
    expect(helper).toContain("limit: 10");
    expect(helper).toContain("quoteMutation");
    expect(helper).toContain('action: "quote_mutation"');
    expect(helper).toContain("limit: 20");
  });

  it("throttles quote creation and mutations before route execution", () => {
    expect(middleware).toContain('request.method === "POST"');
    expect(middleware).toContain('request.method === "PATCH"');
    expect(middleware).toContain('pathname === "/api/quotes"');
    expect(middleware).toContain("API_RATE_LIMIT_POLICIES.quoteCreate");
    expect(middleware).toContain("API_RATE_LIMIT_POLICIES.quoteMutation");
    expect(middleware).toContain("consumeApiRateLimit(user.id, policy)");
    expect(middleware).toContain("apiRateLimitExceededResponse(policy, rateLimit)");
  });

  it("does not spend the quote write quota on GET requests", () => {
    const quotePolicyBlock = middleware.slice(
      middleware.indexOf('pathname === "/api/quotes"'),
      middleware.indexOf('pathname === "/api/stripe/create-checkout-session"')
    );

    expect(quotePolicyBlock).not.toContain('request.method === "GET"');
  });

  it("keeps quote and rate-limit changes behind the full Golden Path gate", () => {
    expect(goldenWorkflow).toContain('      - "app/api/quotes/**"');
    expect(goldenWorkflow).toContain('      - "lib/api-rate-limit.ts"');
    expect(goldenWorkflow).toContain('      - "lib/supabase/middleware.ts"');
  });

  it("keeps rate-limit backend failure generic and fail-closed", () => {
    expect(middleware).toContain('code: "KLYX_RATE_LIMIT_UNAVAILABLE"');
    expect(middleware).toContain("status: 503");
    expect(middleware).toContain('"Retry-After": "5"');
  });
});
