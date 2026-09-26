import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");
}

const policy = read("lib/external-cost-control.ts");
const server = read("lib/external-cost-control-server.ts");
const ai = read("lib/klyx-ai.ts");
const llm = read("lib/brain/llm/openai-provider.ts");
const llmRouter = read("lib/brain/llm/provider.ts");
const vision = read("lib/photo-vision-analysis.ts");
const health = read("app/api/admin/openai-health/route.ts");
const twilio = read("lib/twilio-verify.ts");
const sumsub = read("lib/sumsub.ts");
const resend = read("lib/email/resend.ts");
const elmah = read("lib/elmah-io.ts");
const rateLimit = read("lib/api-rate-limit.ts");
const masterState = read("docs/KLYX_MASTER_STATE.md");

describe("KLYX external cost control contract", () => {
  it("defaults to a zero-cost posture and keeps the historical 0 EUR target", () => {
    expect(policy).toContain('return "ZERO_COST"');
    expect(masterState).toContain("Target infrastructure spending:");
    expect(masterState).toContain("0 €");
  });

  it("covers every audited external provider in one policy registry", () => {
    for (const provider of [
      "openai",
      "supabase",
      "stripe",
      "sumsub",
      "twilio",
      "resend",
      "tolgee",
      "cloudflare",
      "elmah",
      "vercel",
      "github",
    ]) {
      expect(policy).toContain(`${provider}: {`);
    }
  });

  it("reuses the canonical durable KLYX quota authority and fails closed", () => {
    expect(server).toContain("consumeApiRateLimit");
    expect(rateLimit).toContain("klyx_consume_api_rate_limit");
    expect(server).toContain("KLYX_EXTERNAL_COST_CONTROL");
    expect(server).toContain("PAID_BUDGET_EXHAUSTED");
    expect(server).toContain("autoDisableNonCritical");
    expect(server).toContain("catch {");
    expect(server).toContain("return blocked;");
  });

  it("answers deterministic KLYX questions before invoking any model", () => {
    const deterministicIndex = ai.indexOf("const deterministic = deterministicKlyxReply(message)");
    const enabledIndex = ai.indexOf("if (!isKlyxAiEnabled())");
    const providerIndex = ai.indexOf("getKlyxLlmProvider()\n        .generate");

    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(enabledIndex).toBeGreaterThan(deterministicIndex);
    expect(providerIndex).toBeGreaterThan(enabledIndex);
    expect(ai).toContain("maxOutputCharacters:\n            1200");
  });

  it("makes Luna the default paid model and guards every OpenAI runtime network path", () => {
    expect(llm).toContain('DEFAULT_MODEL =\n  "gpt-5.6-luna"');
    expect(llm).toContain("requireKlyxExternalCall");
    expect(llm).toContain('operation: "llm_generate"');
    expect(llmRouter).toContain("klyxExternalNetworkAllowedSynchronously");

    expect(vision).toContain('DEFAULT_VISION_MODEL = "gpt-5.6-luna"');
    expect(vision).toContain("authorizeKlyxExternalCall");
    expect(vision).toContain('operation: "photo_vision_analysis"');

    expect(health).toContain("authorizeKlyxExternalCall");
    expect(health).toContain('operation: "admin_health_probe"');
    expect(health).toContain("OPENAI_COST_CONTROLLED");
  });

  it("blocks KYC and SMS network spend by default", () => {
    expect(sumsub).toContain("klyxExternalNetworkAllowedSynchronously");
    expect(sumsub).toContain("requireKlyxExternalCall");
    expect(sumsub).toContain('operation: "kyc_verification_start"');

    expect(twilio).toContain("requireKlyxExternalCall");
    expect(twilio).toContain('operation: "verify_sms_send"');
    expect(twilio).toContain('operation: "verify_sms_check"');
  });

  it("keeps Resend under a safety margin below the free provider quota", () => {
    expect(policy).toContain("freeDailyActions: 80");
    expect(policy).toContain("freeMonthlyActions: 2_400");
    expect(resend).toContain("authorizeKlyxExternalCall");
    expect(resend).toContain('provider: "resend"');
    expect(resend).toContain("return skippedResult()");
  });

  it("turns paid noncritical telemetry off unless explicitly budgeted", () => {
    expect(elmah).toContain('KLYX_EXTERNAL_COST_MODE?.trim().toUpperCase() !== "PAID_CONTROLLED"');
    expect(elmah).toContain("ELMAH_MIN_MONTHLY_BUDGET_USD = 26");
    expect(elmah).toContain("return null;");
  });

  it("preserves explicit alert thresholds and hard budget stop semantics", () => {
    expect(policy).toContain("percent >= 100");
    expect(policy).toContain("percent >= 90");
    expect(policy).toContain("percent >= 75");
    expect(policy).toContain('reason: "PAID_BUDGET_EXHAUSTED"');
  });
});
