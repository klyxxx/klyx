import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const migration = read(
  "supabase/migrations/20260927163000_klyx_provider_cost_control.sql"
);
const serverGate = read("lib/providers/server-cost-control.ts");
const llmProvider = read("lib/brain/llm/provider.ts");
const vision = read("lib/photo-vision-analysis.ts");
const twilio = read("lib/twilio-verify.ts");
const sumsub = read("lib/sumsub.ts");
const openAiHealth = read("app/api/admin/openai-health/route.ts");

describe("provider cost control", () => {
  it("is fail-closed and does not activate a paid provider implicitly", () => {
    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain("rollout_state text not null default 'DISABLED'");
    expect(migration).toContain("POLICY_MISSING");
    expect(migration).toContain("POLICY_DISABLED");
    expect(migration).not.toMatch(
      /insert\s+into\s+public\.provider_cost_policies/i
    );
  });

  it("enforces rollout, call quotas and reserved-cost budgets atomically", () => {
    for (const state of [
      "INTERNAL",
      "TEST",
      "PILOT",
      "LIMITED",
      "GENERAL",
    ]) {
      expect(migration).toContain(`'${state}'`);
    }

    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("CALL_BUDGET_EXHAUSTED");
    expect(migration).toContain("COST_BUDGET_EXHAUSTED");
    expect(migration).toContain("reserve_cost_minor_per_call");
    expect(migration).toContain("max_reserved_cost_minor_per_window");
    expect(migration).toContain(
      "unique (provider, operation, environment, request_key)"
    );
  });

  it("keeps the budget gate server-only and requires an explicit rollout audience", () => {
    expect(serverGate).toContain('import "server-only"');
    expect(serverGate).toContain("KLYX_PROVIDER_COST_AUDIENCE");
    expect(serverGate).toContain(
      "KLYX_PROVIDER_COST_AUDIENCE_MISSING_OR_INVALID"
    );
    expect(serverGate).toContain("reserve_provider_cost_budget");
  });

  it("gates the user-facing paid provider operations", () => {
    expect(llmProvider).toContain('provider: "openai"');
    expect(llmProvider).toContain('operation: "responses.generate"');

    expect(vision).toContain('provider: "openai"');
    expect(vision).toContain('operation: "responses.vision"');
    expect(vision).toContain("vision_cost_gate_blocked");

    expect(twilio).toContain('provider: "twilio"');
    expect(twilio).toContain('operation: "verify.sms.send"');

    expect(sumsub).toContain('provider: "sumsub"');
    expect(sumsub).toContain('operation: "identity.sdk_session"');
  });

  it("also prevents a paid OpenAI health probe from bypassing the cost gate", () => {
    expect(openAiHealth).toContain("reserveKlyxProviderBudget");
    expect(openAiHealth).toContain('operation: "responses.health_check"');
    expect(openAiHealth).toContain("OPENAI_COST_GATE_BLOCKED");
  });

  it("keeps the database gate inaccessible to browser roles", () => {
    expect(migration).toContain(
      "revoke all on function public.reserve_provider_cost_budget"
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
