import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("KLYX zero-budget external provider contract", () => {
  it("keeps deterministic assistant routing ahead of LLM fallback", () => {
    const router = source("lib/assistant-capability-router.ts");

    expect(router).toContain('costMode: "deterministic_free"');
    expect(router).toContain('costMode: "llm_fallback"');
    expect(router).toContain("delegateToLegacy: false");
  });

  it("layers cost policy onto the certified Provider Control Plane instead of duplicating it", () => {
    const policy = source("lib/providers/cost-policy.ts");
    const runtime = source("lib/providers/cost-runtime.ts");

    expect(policy).toContain("createKlyxProviderControlPlaneRegistry");
    expect(runtime).toContain("new KlyxProviderControlPlane");
    expect(fs.existsSync(path.join(process.cwd(), "lib/providers/cost-control.ts"))).toBe(
      false
    );
  });

  it("routes variable-cost provider calls through the cost-aware control plane", () => {
    expect(source("lib/brain/llm/provider.ts")).toContain(
      'getKlyxExternalProviderCostDecision("openai")'
    );
    expect(source("lib/sumsub.ts")).toContain(
      'assertKlyxExternalProviderCostAllowed("sumsub")'
    );
    expect(source("lib/twilio-verify.ts")).toContain(
      'assertKlyxExternalProviderCostAllowed("twilio")'
    );
    expect(source("lib/elmah-io.ts")).toContain(
      'getKlyxExternalProviderCostDecision("elmah_io")'
    );
  });

  it("keeps Resend under a durable conservative free-tier envelope", () => {
    const policy = source("lib/providers/cost-policy.ts");
    const guard = source("lib/providers/resend-zero-cost-guard.ts");
    const resend = source("lib/email/resend.ts");

    expect(policy).toContain("perDay: 50");
    expect(policy).toContain("perMonth: 1_500");
    expect(guard).toContain("transactional_email_deliveries");
    expect(resend).toContain("getKlyxResendZeroCostDecision");
  });

  it("idles heavy financial polling while zero-budget and LIVE is off", () => {
    const route = source("app/api/ops/financial-runtime-tick/route.ts");

    expect(route).toContain("useZeroBudgetIdleTick");
    expect(route).toContain('process.env.KLYX_LIVE_PAYMENTS_ENABLED === "true"');
    expect(route).toContain("now.getUTCMinutes() % 15 !== 0");
  });

  it("does not certify paid mode implicitly", () => {
    const runtime = source("lib/providers/cost-runtime.ts");
    const policy = source("lib/providers/cost-policy.ts");

    expect(runtime).toContain('"guarded_paid"');
    expect(policy).toContain("allDisabledOverrides");
  });
});
