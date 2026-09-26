import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const policy = read("lib/external-cost-policy.ts");
const server = read("lib/external-cost-control-server.ts");
const ai = read("lib/klyx-ai.ts");
const llm = read("lib/brain/llm/provider.ts");
const twilio = read("lib/twilio-verify.ts");
const sumsub = read("lib/sumsub.ts");
const resend = read("lib/email/resend.ts");
const migration = read(
  "supabase/migrations/20260926214500_klyx_external_cost_control.sql"
);
const ops = read("docs/KLYX_OPERATIONS_FAILURE_DOMAINS.md");

describe("KLYX external cost control contract", () => {
  it("defaults paid providers and the global spend gate to zero budget", () => {
    expect(policy).toContain('defaultMonthlyBudgetMicrousd: 0');
    expect(policy).toContain('KLYX_EXTERNAL_PAID_BUDGET_USD');
    expect(policy).toContain('fallback: "deterministic_klyx"');
    expect(policy).toContain('defaultMonthlyUnitLimit: 2700');
  });

  it("routes deterministic assistant questions locally before the AI call gate", () => {
    const deterministicIndex = ai.indexOf(
      "const deterministic = deterministicKlyxReply(message)"
    );
    const enabledIndex = ai.indexOf("if (!isKlyxAiEnabled())", deterministicIndex);
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(enabledIndex).toBeGreaterThan(deterministicIndex);
  });

  it("guards all OpenAI provider generation behind durable reservation", () => {
    expect(llm).toContain('provider: "openai"');
    expect(llm).toContain('action: "llm_response"');
    expect(llm).toContain("assertExternalProviderAction");
  });

  it("guards Twilio and Sumsub before initiating potentially billable work", () => {
    expect(twilio).toContain('provider: "twilio"');
    expect(twilio).toContain('action: "phone_otp_verification"');
    expect(sumsub).toContain('provider: "sumsub"');
    expect(sumsub).toContain('action: "identity_verification_start"');
  });

  it("keeps Resend below an internal quota and fails closed if cost control is unavailable", () => {
    expect(resend).toContain('provider: "resend"');
    expect(resend).toContain("KLYX_RESEND_COST_CONTROL_UNAVAILABLE");
  });

  it("reserves provider usage atomically before outbound calls", () => {
    expect(migration).toContain("external_provider_usage_monthly");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("MONTHLY_UNIT_LIMIT_EXCEEDED");
    expect(migration).toContain("MONTHLY_BUDGET_EXCEEDED");
    expect(server).toContain("KLYX_EXTERNAL_COST_CIRCUIT_OPEN");
    expect(server).toContain("KLYX_EXTERNAL_COST_ALERT");
  });

  it("does not replace the canonical operational kill-switch authority", () => {
    expect(ops).toContain("ops_capability_controls");
    expect(migration).toContain("ops_capability_controls");
    expect(migration).toContain("financial LIVE authority remains unchanged");
  });
});
