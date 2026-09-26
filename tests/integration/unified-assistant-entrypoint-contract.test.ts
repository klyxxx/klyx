import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const nextConfig = read("next.config.ts");
const unified = read("app/api/assistant/unified/route.ts");
const capabilityRouter = read("lib/assistant-capability-router.ts");
const deterministicReplies = read("lib/assistant-deterministic-replies.ts");
const localeProvider = read("app/components/KlyxLocaleProvider.tsx");

describe("KLYX assistant single product entrypoint", () => {
  it("routes the visible durable assistant endpoint through one control plane", () => {
    expect(nextConfig).toContain('source: "/api/brain/converse"');
    expect(nextConfig).toContain('destination: "/api/assistant/unified"');
    expect(unified).toContain('from "@/app/api/brain/converse/route"');
    expect(unified).toContain("routeKlyxAssistantCapability(message)");
  });

  it("reuses certified engines instead of duplicating business authorities", () => {
    expect(unified).toContain('from "@/app/api/provider/sumsub/status/route"');
    expect(unified).toContain("legacyConversePost(");
    expect(unified).toContain("getProviderKycStatus(kycRequest)");
    expect(capabilityRouter).toContain('matching: { authority: "service_matching" }');
    expect(capabilityRouter).toContain('stripe: { authority: "external_payment_state" }');
    expect(capabilityRouter).toContain('ledger: { authority: "financial_truth" }');
  });

  it("keeps sensitive decisions outside the LLM", () => {
    for (const authority of [
      '"payment"',
      '"kyc"',
      '"eligibility"',
      '"settlement"',
      '"refund"',
      '"sensitive_mutation"',
    ]) {
      expect(capabilityRouter).toContain(authority);
    }

    expect(unified).toContain('decisionAuthority: "deterministic_engine"');
    expect(unified).toContain("llmAllowed: false");
    expect(unified).not.toContain("createRefund");
    expect(unified).not.toContain("stripe.transfers");
    expect(unified).not.toContain("paymentIntents.create");
    expect(unified).not.toContain("settle");
  });

  it("answers common product/account/payment/refund/provider/KYC questions without AI", () => {
    expect(deterministicReplies).toContain('params.capability === "klyx_information"');
    expect(deterministicReplies).toContain('params.capability === "account_profile"');
    expect(deterministicReplies).toContain('params.capability === "payment_explanation"');
    expect(deterministicReplies).toContain('params.capability === "refund_explanation"');
    expect(deterministicReplies).toContain('params.capability === "provider_help"');
    expect(deterministicReplies).toContain('params.capability === "kyc_explanation"');
  });

  it("changes language through the locale/Tolgee runtime rather than an LLM", () => {
    expect(unified).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(unified).toContain('engine: "tolgee"');
    expect(unified).toContain('headers.set("x-klyx-locale-change"');
    expect(localeProvider).toContain("readLocaleCookie");
    expect(localeProvider).toContain("syncLocaleFromCookie");
  });

  it("keeps every assistant exchange in durable Brain conversation history", () => {
    expect(unified).toContain("resolveAssistantConversation({");
    expect(unified).toContain("appendAssistantExchange({");
    expect(unified).toContain("conversationId: conversation.conversationId");
  });
});
