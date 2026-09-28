import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const costControl = read("lib/providers/cost-control.ts");
const costServer = read("lib/providers/cost-usage-server.ts");
const openai = read("lib/brain/llm/openai-provider.ts");
const vision = read("lib/photo-vision-analysis.ts");
const photoRoute = read("app/api/requests/photo/photo-route-core.ts");
const openaiHealth = read("app/api/admin/openai-health/route.ts");
const openaiE2e = read("app/api/admin/openai-e2e/route.ts");
const sumsub = read("lib/sumsub.ts");
const sumsubStatus = read("app/api/provider/sumsub/status/route.ts");
const twilio = read("lib/twilio-verify.ts");
const resend = read("lib/email/resend.ts");
const elmah = read("lib/elmah-io.ts");
const elmahDeploy = read("scripts/operations/elmah-deployment.mjs");
const migration = read(
  "supabase/migrations/20260927162500_klyx_external_provider_usage_budget.sql"
);

describe("KLYX external cost control plane contract", () => {
  it("has no unbounded mode and defaults paid external calls to zero", () => {
    expect(costControl).toContain('export type KlyxExternalCostMode = "zero" | "bounded"');
    expect(costControl).not.toContain('"unlimited"');
    expect(costControl).not.toContain('"unrestricted"');
    expect(costControl).toContain("zeroDaily: 0");
    expect(costControl).toContain("zeroMonthly: 0");
  });

  it("keeps every runtime OpenAI path behind the same bounded quota", () => {
    expect(openai).toContain('const DEFAULT_MODEL = "gpt-5.6-luna"');
    expect(openai).toContain('meter: "openai_request"');
    expect(openai).toContain("MAX_CONVERSATION_CHARACTERS = 12_000");
    expect(openai).toContain("MAX_CONTEXT_CHARACTERS = 8_000");
    expect(openai).toContain("MAX_OUTPUT_TOKENS = 900");
    expect(openai).toContain("available: configured && budgetArmed");

    expect(vision).toContain('const DEFAULT_VISION_MODEL = "gpt-5.6-luna"');
    expect(vision).toContain('isKlyxExternalMeterArmed("openai_request")');
    expect(photoRoute).toContain('meter: "openai_request"');
    expect(photoRoute).toContain("vision_cost_budget_exhausted");
    expect(openaiHealth).toContain('meter: "openai_request"');
    expect(openaiHealth).toContain("OPENAI_COST_BUDGET_DISABLED");
    expect(openaiE2e).toContain('meter: "openai_request"');
  });

  it("does not poll Sumsub for assistant/status reads and gates only new verification sessions", () => {
    expect(sumsub).toContain('meter: "sumsub_verification_session"');
    expect(sumsubStatus).toContain('.from("provider_verifications")');
    expect(sumsubStatus).not.toContain("sumsubRequest(");
    expect(sumsubStatus).not.toContain("api.sumsub.com");
  });

  it("gates Twilio sends but lets an already-started OTP be checked", () => {
    expect(twilio).toContain('meter: "twilio_verification_start"');
    const sendStart = twilio.indexOf("export async function sendPhoneOtp");
    const verifyStart = twilio.indexOf("export async function verifyPhoneOtp");
    expect(twilio.slice(sendStart, verifyStart)).toContain(
      "requireKlyxExternalProviderUsage"
    );
    expect(twilio.slice(verifyStart)).not.toContain(
      'meter: "twilio_verification_start"'
    );
  });

  it("keeps email under a free-tier safety margin and degrades at the cap", () => {
    expect(costControl).toContain("zeroDaily: 90");
    expect(costControl).toContain("zeroMonthly: 2700");
    expect(resend).toContain('meter: "resend_email"');
    expect(resend).toContain("return skippedResult()");
  });

  it("disables elmah external delivery unless bounded budget is explicitly armed", () => {
    expect(elmah).toContain("isKlyxElmahIoCostEnabled");
    expect(elmahDeploy).toContain("elmahCostArmed()");
    expect(elmahDeploy).toContain('!== "bounded"');
  });

  it("reserves quotas atomically in Supabase and never trusts browser clients", () => {
    expect(migration).toContain("klyx_external_provider_usage_windows");
    expect(migration).toContain("klyx_external_provider_usage_reservations");
    expect(migration).toContain("klyx_reserve_external_provider_usage");
    expect(migration).toContain("for update");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
    expect(costServer).toContain("usage_store_unavailable");
    expect(costServer).toContain("KLYX_COST_");
  });

  it("keeps external prices out of runtime policy", () => {
    expect(costControl).not.toMatch(/\$\d/);
    expect(costControl).not.toMatch(/€\d/);
  });
});
