import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX zero-cost external provider contract", () => {
  it("keeps OpenAI provider creation and shadow execution behind the central spend gate", () => {
    const provider = read("lib/brain/llm/provider.ts");
    const shadow = read("lib/brain/llm/shadow.ts");

    expect(provider).toContain(
      'isKlyxExternalProviderSpendAllowed("openai")'
    );
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

  it("blocks Sumsub and Twilio before their external fetch calls", () => {
    const sumsub = read("lib/sumsub.ts");
    const twilio = read("lib/twilio-verify.ts");

    expect(sumsub).toContain(
      'assertKlyxExternalProviderSpendAllowed("sumsub")'
    );
    expect(
      sumsub.indexOf('assertKlyxExternalProviderSpendAllowed("sumsub")')
    ).toBeLessThan(sumsub.indexOf("await fetch("));

    expect(twilio).toContain(
      'assertKlyxExternalProviderSpendAllowed("twilio")'
    );
    expect(
      twilio.indexOf('assertKlyxExternalProviderSpendAllowed("twilio")')
    ).toBeLessThan(twilio.indexOf("await fetch("));
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
});
