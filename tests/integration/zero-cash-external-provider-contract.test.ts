import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const costMode = read("lib/providers/cost-mode.ts");
const costGovernance = read("lib/providers/cost-governance.ts");
const klyxAi = read("lib/klyx-ai.ts");
const openAi = read("lib/brain/llm/openai-provider.ts");
const vision = read("lib/photo-vision-analysis.ts");
const openAiHealth = read("app/api/admin/openai-health/route.ts");
const sumsub = read("lib/sumsub.ts");
const twilio = read("lib/twilio-verify.ts");
const resend = read("lib/email/resend.ts");
const elmah = read("lib/elmah-io.ts");

describe("KLYX zero-cash external provider contract", () => {
  it("fails safe to zero cash when configuration is absent", () => {
    expect(costMode).toContain('return "zero_cash"');
    expect(costGovernance).toContain('case "openai"');
    expect(costGovernance).toContain('case "sumsub"');
    expect(costGovernance).toContain('case "twilio"');
    expect(costGovernance).toContain('case "elmah_io"');
    expect(costGovernance).toContain('reasonCode: "ZERO_CASH_PAID_PROVIDER_BLOCKED"');
  });

  it("routes deterministic KLYX questions locally before model admission", () => {
    const deterministic = klyxAi.indexOf("tryDeterministicKlyxReply(message)");
    const modelGate = klyxAi.indexOf("if (!isKlyxAiEnabled())");

    expect(deterministic).toBeGreaterThan(-1);
    expect(modelGate).toBeGreaterThan(deterministic);
    expect(klyxAi).toContain('klyxExternalProviderAllowed("openai")');
  });

  it("uses the current lowest-cost general OpenAI model and guards direct LLM calls", () => {
    expect(openAi).toContain('"gpt-6-luna"');
    expect(openAi).toContain('assertKlyxExternalProviderAllowed(\n      "openai"');
    expect(openAi).toContain('"llm.generate"');
  });

  it("prevents paid vision and paid admin probes from bypassing zero-cash mode", () => {
    expect(vision).toContain("!isKlyxZeroCashMode()");
    expect(vision).toContain('DEFAULT_VISION_MODEL = "gpt-6-luna"');
    expect(openAiHealth).toContain('getKlyxExternalCostDecision(\n        "openai"');
    expect(openAiHealth).toContain("if (!costDecision.allowed)");
  });

  it("guards Sumsub and Twilio at their real transport boundaries", () => {
    expect(sumsub).toContain('assertKlyxExternalProviderAllowed(\n    "sumsub"');
    expect(sumsub).toContain('`api.${params.method.toLowerCase()}`');
    expect(twilio).toContain('assertKlyxExternalProviderAllowed(\n    "twilio"');
    expect(twilio).toContain('"otp.send"');
    expect(twilio).toContain('"otp.verify"');
  });

  it("degrades optional elmah.io and keeps Resend behind its free-path decision", () => {
    expect(elmah).toContain('klyxExternalProviderAllowed("elmah_io")');
    expect(resend).toContain('klyxExternalProviderAllowed("resend")');
    expect(costGovernance).toContain("max: 90");
    expect(costGovernance).toContain("max: 8");
  });

  it("never enables Stripe LIVE as part of cost governance", () => {
    expect(costGovernance).toContain("KLYX_LIVE_PAYMENTS_ENABLED");
    expect(costGovernance).toContain('reasonCode: "ZERO_CASH_TEST_ONLY"');
    expect(costGovernance).not.toContain('KLYX_LIVE_PAYMENTS_ENABLED = "true"');
  });
});
