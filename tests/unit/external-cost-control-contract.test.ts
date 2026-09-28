import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("external cost control integration contract", () => {
  it("defaults the server cost mode to zero", () => {
    const control = source("lib/providers/cost-control-server.ts");
    expect(control).toContain('return process.env.KLYX_EXTERNAL_COST_MODE');
    expect(control).toContain('? "guarded"');
    expect(control).toContain(': "zero"');
  });

  it("uses one provider-wide durable quota bucket across actions", () => {
    const control = source("lib/providers/cost-control-server.ts");
    expect(control).toContain('action: `external_cost_${provider}_day`');
    expect(control).toContain('action: `external_cost_${provider}_30d`');
    expect(control).not.toContain('external_cost_${provider}_${action}_day');
    expect(control).not.toContain('external_cost_${provider}_${action}_30d');
  });

  it("supports non-consuming recovery/completion calls", () => {
    const control = source("lib/providers/cost-control-server.ts");
    expect(control).toContain("consumeQuota?: boolean");
    expect(control).toContain("if (options.consumeQuota === false)");
  });

  it("gates OpenAI before the network request and caps output", () => {
    const openai = source("lib/brain/llm/openai-provider.ts");
    const guard = openai.indexOf(
      'assertExternalProviderCallAllowed("openai", "llm_generate")'
    );
    const network = openai.indexOf("await fetch(OPENAI_RESPONSES_URL");
    expect(guard).toBeGreaterThan(-1);
    expect(network).toBeGreaterThan(guard);
    expect(openai).toContain("max_output_tokens: getMaxOutputTokens()");
    expect(openai).toContain("HARD_MAX_OUTPUT_TOKENS = 1_200");
  });

  it("gates Sumsub before creating a verification session", () => {
    const sumsub = source("lib/sumsub.ts");
    const guard = sumsub.indexOf(
      'assertExternalProviderCallAllowed("sumsub", "verification_session")'
    );
    const network = sumsub.indexOf('path: "/resources/accessTokens/sdk"');
    expect(guard).toBeGreaterThan(-1);
    expect(network).toBeGreaterThan(guard);
  });

  it("charges Twilio quota on send but lets an existing OTP check complete", () => {
    const twilio = source("lib/twilio-verify.ts");
    expect(twilio).toContain(
      'assertExternalProviderCallAllowed("twilio", "otp_send")'
    );
    expect(twilio).toContain(
      'assertExternalProviderCallAllowed("twilio", "otp_check", {'
    );
    expect(twilio).toContain("consumeQuota: false");
  });

  it("degrades Resend instead of failing a workflow when free quota is unavailable", () => {
    const resend = source("lib/email/resend.ts");
    expect(resend).toContain('authorizeExternalProviderCall(\n    "resend"');
    expect(resend).toContain("return skippedResult()");
  });

  it("keeps elmah.io non-authoritative when its cost circuit is open", () => {
    const elmah = source("lib/elmah-io.ts");
    expect(elmah).toContain('authorizeExternalProviderCall(\n    "elmah_io"');
    expect(elmah).toContain("if (!budget.allowed)");
    expect(elmah).toContain("return false");
  });

  it("routes deterministic assistant questions before OpenAI", () => {
    const assistant = source("lib/klyx-ai.ts");
    const deterministic = assistant.indexOf(
      "getDeterministicKlyxReply(message)"
    );
    const llm = assistant.indexOf("getKlyxLlmProvider().generate");
    expect(deterministic).toBeGreaterThan(-1);
    expect(llm).toBeGreaterThan(deterministic);
  });
});
