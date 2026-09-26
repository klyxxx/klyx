import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const nextConfig = read("next.config.ts");
const gateway = read("app/api/assistant/gateway/route.ts");
const router = read("lib/assistant-intent-router.ts");
const policy = read("lib/assistant-engine-policy.ts");
const stateMachine = read("lib/brain/orchestrator/state-machine.ts");
const localeProvider = read("app/components/KlyxLocaleProvider.tsx");

describe("KLYX assistant single product entry contract", () => {
  it("routes the public Brain conversation endpoint through one gateway", () => {
    expect(nextConfig).toContain('source: "/api/brain/converse"');
    expect(nextConfig).toContain('destination: "/api/assistant/gateway"');
    expect(gateway).toContain('POST as legacyConversePost');
  });

  it("covers the required product intents", () => {
    for (const intent of [
      "service_need",
      "account_help",
      "booking_tracking",
      "payment_explanation",
      "refund_explanation",
      "provider_help",
      "kyc_explanation",
      "locale_change",
      "income_search",
      "mission_management",
      "information",
    ]) {
      expect(router).toContain(`\"${intent}\"`);
    }
  });

  it("uses deterministic product knowledge before the AI fallback", () => {
    const deterministicIndex = gateway.indexOf("deterministicInformation(message, locale)");
    const fallbackIndex = gateway.indexOf("return legacyConversePost(request);", deterministicIndex);

    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(deterministicIndex);
    expect(policy).toContain('return intent === "information"');
  });

  it("keeps Stripe and Sumsub as read projections from the assistant", () => {
    expect(policy).toContain('{ engine: "stripe", access: "read"');
    expect(policy).toContain('{ engine: "sumsub", access: "read"');
    expect(gateway).not.toContain("stripe.paymentIntents.create");
    expect(gateway).not.toContain("stripe.refunds.create");
    expect(gateway).not.toContain("stripe.transfers.create");
    expect(gateway).not.toContain('.from("provider_verifications").update');
  });

  it("keeps sensitive workflow execution outside the assistant", () => {
    expect(policy).toContain("assistantMayDirectlyMutateSensitiveAuthority");
    expect(policy).toContain("return false");
    expect(stateMachine).toContain("assistantMayExecuteActionDirectly");
    expect(stateMachine).toContain("return false");
    expect(gateway).toContain("directMutationAllowed: false");
    expect(gateway).toContain("llmAuthority: false");
  });

  it("changes language through the canonical locale cookie and Tolgee provider", () => {
    expect(gateway).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(gateway).toContain("response.cookies.set");
    expect(localeProvider).toContain("readLocaleCookie");
    expect(localeProvider).toContain("translateKlyxTolgeeRuntimeUi");
  });

  it("does not create a parallel public assistant surface", () => {
    expect(gateway).toContain('route: "/api/assistant/gateway"');
    expect(nextConfig).toContain('source: "/api/brain/converse"');
  });
});
