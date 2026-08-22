import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const migration = readRepoFile(
  "supabase/migrations/20260821204000_klyx_durable_api_rate_limits.sql"
);
const helper = readRepoFile("lib/api-rate-limit.ts");
const aiRoute = readRepoFile("app/api/ai/respond/route.ts");
const analyzeRoute = readRepoFile("app/api/requests/analyze/route.ts");
const photoRoute = readRepoFile(
  "app/api/requests/photo/photo-route-core.ts"
);
const quoteDraftRoute = readRepoFile(
  "app/api/provider/quotes/draft/quote-draft-route-core.ts"
);
const preflight = readRepoFile("scripts/golden-path-preflight.mjs");

describe("KLYX durable API rate limiting", () => {
  it("keeps the Golden preflight syntax valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-preflight.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("stores only hashed subject keys in a server-only table", () => {
    expect(migration).toContain("create table if not exists public.api_rate_limits");
    expect(migration).toContain("key_hash text not null");
    expect(migration).toContain("key_hash ~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.api_rate_limits from anon");
    expect(migration).toContain(
      "revoke all on table public.api_rate_limits from authenticated"
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.api_rate_limits to service_role"
    );
  });

  it("uses one atomic PostgreSQL upsert and bounds blocked counters", () => {
    expect(migration).toContain("create or replace function public.klyx_consume_api_rate_limit");
    expect(migration).toContain("security definer");
    expect(migration).toContain("on conflict (key_hash, action) do update");
    expect(migration).toContain("least(limits.request_count + 1, p_limit + 1)");
    expect(migration).toContain("allowed := v_count <= p_limit");
    expect(migration).toContain("retry_after_seconds := case");
  });

  it("does not expose the rate-limit RPC to browser roles", () => {
    expect(migration).toContain(
      "revoke all on function public.klyx_consume_api_rate_limit(text, text, integer, integer)\n  from anon"
    );
    expect(migration).toContain(
      "revoke all on function public.klyx_consume_api_rate_limit(text, text, integer, integer)\n  from authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_consume_api_rate_limit(text, text, integer, integer)\n  to service_role"
    );
  });

  it("hashes authenticated subjects before the service-role RPC", () => {
    expect(helper).toContain('createHash("sha256")');
    expect(helper).toContain('update(`klyx-rate-limit:${subjectId}`, "utf8")');
    expect(helper).toContain('"klyx_consume_api_rate_limit"');
    expect(helper).toContain('code: "KLYX_RATE_LIMITED"');
    expect(helper).toContain('headers["Retry-After"]');
    expect(helper).not.toContain("x-forwarded-for");
  });

  it("limits external AI, universal analysis, photo analysis and quote draft routes", () => {
    for (const route of [aiRoute, analyzeRoute, photoRoute, quoteDraftRoute]) {
      expect(route).toContain("consumeApiRateLimit");
      expect(route).toContain("apiRateLimitExceededResponse");
    }

    expect(aiRoute).toContain("API_RATE_LIMIT_POLICIES.aiRespond");
    expect(analyzeRoute).toContain("API_RATE_LIMIT_POLICIES.requestAnalysis");
    expect(photoRoute).toContain("API_RATE_LIMIT_POLICIES.photoAnalysis");
    expect(quoteDraftRoute).toContain("API_RATE_LIMIT_POLICIES.quoteDraft");
    expect(helper).toContain('action: "photo_analysis"');
    expect(helper).toContain('action: "quote_draft"');
    expect(helper).toContain("limit: 6");
    expect(helper).toContain("limit: 12");
  });

  it("proves allow, block, bounded counting and browser-role denial in Golden", () => {
    expect(preflight).toContain('const limit = 3');
    expect(preflight).toContain('{ allowed: true, remaining: 0, count: 3 }');
    expect(preflight).toContain('{ allowed: false, remaining: 0, count: 4 }');
    expect(preflight).toContain("Authenticated clients must not execute the server-only rate-limit RPC.");
    expect(preflight).toContain("Authenticated clients must not read server-only rate-limit counters.");
    expect(preflight).toContain("durableRateLimitVerified: true");
  });
});
