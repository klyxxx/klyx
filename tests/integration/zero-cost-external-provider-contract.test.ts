import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX zero-cost external provider contract", () => {
  it("keeps OpenAI provider creation, direct transport and shadow execution behind the central spend gate", () => {
    const provider = read("lib/brain/llm/provider.ts");
    const directTransport = read("lib/brain/llm/openai-provider.ts");
    const shadow = read("lib/brain/llm/shadow.ts");

    expect(provider).toContain(
      'isKlyxExternalProviderSpendAllowed("openai")'
    );
    expect(directTransport).toContain(
      'assertKlyxExternalProviderSpendAllowed("openai")'
    );
    expect(
      directTransport.indexOf(
        'assertKlyxExternalProviderSpendAllowed("openai")'
      )
    ).toBeLessThan(directTransport.indexOf("await fetch("));
    expect(shadow).toContain(
      'isKlyxExternalProviderSpendAllowed("openai")'
    );
    expect(shadow).toContain("usedForUserReply: false");
  });

  it("answers deterministic KLYX questions before checking whether AI is enabled", () => {
    const ai = read("lib/klyx-ai.ts");
    const deterministicIndex = ai.indexOf(
      "const deterministicReply ="
    );
    const enabledIndex = ai.indexOf(
      "if (!isKlyxAiEnabled())"
    );

    expect(ai).toContain("export function deterministicKlyxReply");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(enabledIndex).toBeGreaterThan(deterministicIndex);
  });

  it("prevents photo vision and admin health probes from bypassing zero-cost OpenAI policy", () => {
    const vision = read("lib/photo-vision-analysis.ts");
    const health = read("app/api/admin/openai-health/route.ts");

    expect(vision).toContain(
      'isKlyxExternalProviderSpendAllowed("openai")'
    );
    expect(
      vision.indexOf('isKlyxExternalProviderSpendAllowed("openai")')
    ).toBeLessThan(vision.indexOf("await fetch("));

    expect(health).toContain('getKlyxExternalCostDecision("openai")');
    expect(health).toContain("if (!costDecision.allowed)");
    expect(health.indexOf("if (!costDecision.allowed)")).toBeLessThan(
      health.indexOf("await fetch(")
    );
  });

  it("blocks Sumsub and Twilio before their recovery-aware external transport calls", () => {
    const sumsub = read("lib/sumsub.ts");
    const twilio = read("lib/twilio-verify.ts");
    const sumsubGuard = 'assertKlyxExternalProviderSpendAllowed("sumsub")';
    const twilioGuard = 'assertKlyxExternalProviderSpendAllowed("twilio")';
    const recoveryTransport = "await fetchWithProviderRecovery(";

    expect(sumsub).toContain(sumsubGuard);
    expect(sumsub).toContain(recoveryTransport);
    expect(sumsub.indexOf(sumsubGuard)).toBeLessThan(
      sumsub.indexOf(recoveryTransport)
    );

    expect(twilio).toContain(twilioGuard);
    expect(twilio).toContain(recoveryTransport);
    expect(twilio.indexOf(twilioGuard)).toBeLessThan(
      twilio.indexOf(recoveryTransport)
    );
  });

  it("degrades Resend and elmah.io without external calls when spend is disabled", () => {
    const resend = read("lib/email/resend.ts");
    const elmah = read("lib/elmah-io.ts");

    expect(resend).toContain(
      'isKlyxExternalProviderSpendAllowed("resend")'
    );
    expect(resend).toContain("return skippedResult()");

    expect(elmah).toContain(
      'isKlyxExternalProviderSpendAllowed("elmah_io")'
    );
    expect(elmah).toContain("return null");
  });

  it("defaults the central external cost mode to zero and requires provider-side cap confirmation for guarded spend", () => {
    const costControl = read("lib/providers/cost-control.ts");

    expect(costControl).toContain(
      'return configured === "guarded" ? "guarded" : "zero"'
    );
    expect(costControl).toContain("SPEND_CAP_CONFIRMED");
    expect(costControl).toContain("MONTHLY_BUDGET_MINOR");
    expect(costControl).toContain("warnAtBps: 8_000");
  });

  it("never lets the cost governor become a Stripe LIVE authorization path", () => {
    const costControl = read("lib/providers/cost-control.ts");

    expect(costControl).toContain('provider === "stripe"');
    expect(costControl).toContain("KLYX_LIVE_PAYMENTS_ENABLED");
    expect(costControl).toContain("STRIPE_TEST_REQUIRED");
    expect(costControl).toContain('secret.startsWith("sk_test_")');
    expect(costControl).toContain('publishable.startsWith("pk_test_")');
  });
});
