import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

const policy = read("lib/external-cost-control.ts");
const server = read("lib/external-cost-control-server.ts");
const ai = read("lib/klyx-ai.ts");
const openai = read("lib/brain/llm/openai-provider.ts");
const vision = read("lib/photo-vision-analysis.ts");
const openaiHealth = read("app/api/admin/openai-health/route.ts");
const twilio = read("lib/twilio-verify.ts");
const sumsub = read("lib/sumsub.ts");
const resend = read("lib/email/resend.ts");
const elmah = read("lib/elmah-io.ts");
const elmahDeployment = read("scripts/operations/elmah-deployment.mjs");
const tolgeeRuntime = read("lib/klyx-tolgee-runtime.ts");
const tolgeeWorkflow = read(".github/workflows/klyx-tolgee-cloud.yml");
const openaiSmoke = read("scripts/run-step-13-58-openai-smoke.ps1");
const vercel = JSON.parse(read("vercel.json")) as {
  git?: { deploymentEnabled?: boolean };
};

describe("KLYX external cost control contract", () => {
  it("defaults to zero cost and has no uncapped runtime mode", () => {
    expect(policy).toContain('export type KlyxExternalCostMode = "zero" | "guarded"');
    expect(server).toContain(': "zero"');
    expect(policy).not.toContain('| "normal"');
  });

  it("reuses the durable rate-limit authority instead of creating another database authority", () => {
    expect(server).toContain("consumeApiRateLimit");
    expect(server).toContain('bucket: "monthly"');
    expect(server).toContain('`external_cost_${input.provider}_${input.bucket}`');
    expect(server).not.toContain("create table");
    expect(server).not.toContain("apply_migration");
  });

  it("answers deterministic KLYX questions before any model call", () => {
    expect(ai).toContain("deterministicKlyxReply");
    const deterministicIndex = ai.indexOf(
      "const deterministic = deterministicKlyxReply(message)"
    );
    const enabledIndex = ai.indexOf("if (!isKlyxAiEnabled())");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(enabledIndex).toBeGreaterThan(deterministicIndex);
  });

  it("guards every OpenAI runtime surface and defaults text generation to Luna", () => {
    expect(openai).toContain('"gpt-5.6-luna"');
    expect(openai).toContain("authorizeKlyxExternalCall");
    expect(openai).toContain('operation: "responses_generate"');
    expect(vision).toContain("authorizeKlyxExternalCall");
    expect(vision).toContain('operation: "photo_vision"');
    expect(openaiHealth).toContain("authorizeKlyxExternalCall");
    expect(openaiHealth).toContain('operation: "health_probe"');
    expect(openaiHealth).toContain("networkChecked: false");
  });

  it("prevents the legacy OpenAI smoke script from escaping zero-cost mode", () => {
    expect(openaiSmoke).toContain("KLYX_EXTERNAL_COST_MODE");
    expect(openaiSmoke).toContain('"guarded"');
    expect(openaiSmoke).toContain('"gpt-5.6-luna"');
    expect(openaiSmoke).toContain("Real API call : NON");
  });

  it("keeps Twilio optional with a non-production local test transport", () => {
    expect(twilio).toContain("authorizeKlyxExternalCall");
    expect(twilio).toContain('provider: "twilio"');
    expect(twilio).toContain('process.env.KLYX_LOCAL_TEST_TRANSPORTS === "1"');
    expect(twilio).toContain('process.env.VERCEL_ENV !== "production"');
    expect(twilio).toContain('"000000"');
  });

  it("blocks starting a paid Sumsub verification before an external call", () => {
    const authIndex = sumsub.indexOf("authorizeKlyxExternalCall");
    const createIndex = sumsub.indexOf('path: "/resources/accessTokens/sdk"');
    expect(authIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(authIndex);
    expect(policy).toContain("minimumMonthlyCommitmentMicroUsd: 149_000_000");
  });

  it("keeps Resend below a safety-buffered free quota", () => {
    expect(resend).toContain("authorizeKlyxExternalCall");
    expect(server).toContain("RESEND_ZERO_MODE_DAILY_LIMIT = 80");
    expect(server).toContain("RESEND_ZERO_MODE_MONTHLY_LIMIT = 2_400");
    expect(server).toContain("FREE_QUOTA_80_PERCENT_WARNING");
  });

  it("disables elmah.io external delivery by default while preserving local observability", () => {
    expect(elmah).toContain("KLYX_EXTERNAL_COST_ELMAH_IO_ENABLED");
    expect(elmah).toContain('KLYX_EXTERNAL_COST_MODE?.trim().toLowerCase() === "guarded"');
    expect(elmahDeployment).toContain("KLYX_EXTERNAL_COST_ELMAH_IO_ENABLED");
  });

  it("keeps Tolgee runtime local and cloud synchronization manual", () => {
    expect(tolgeeRuntime).toContain("messages/tolgee");
    expect(tolgeeWorkflow).toContain("workflow_dispatch");
    expect(tolgeeWorkflow).not.toContain("schedule:");
  });

  it("keeps automatic Vercel Git deployments disabled", () => {
    expect(vercel.git?.deploymentEnabled).toBe(false);
  });

  it("allows cost bypass only for unit/integration test processes", () => {
    expect(server).toContain('process.env.NODE_ENV === "test"');
    expect(server).toContain('process.env.KLYX_EXTERNAL_COST_TEST_BYPASS === "1"');
  });

  it("keeps financial LIVE outside the cost plane", () => {
    expect(policy).not.toContain("KLYX_LIVE_PAYMENTS_ENABLED");
    expect(server).not.toContain("KLYX_LIVE_PAYMENTS_ENABLED");
    expect(server).not.toContain("STRIPE_SECRET_KEY");
  });
});
