import { describe, expect, it } from "vitest";

import {
  assistantEnginePlan,
  assistantIntentMayUseLlm,
  assistantMayDirectlyMutateSensitiveAuthority,
} from "../../lib/assistant-engine-policy";
import {
  accountHelp,
  detectRequestedAssistantLocale,
  deterministicInformation,
  languageChangeReply,
} from "../../lib/assistant-product-help";

describe("assistant deterministic product help", () => {
  it("answers common KLYX questions without LLM", () => {
    const answer = deterministicInformation("Comment fonctionne KLYX ?", "fr");

    expect(answer?.topic).toBe("klyx_overview");
    expect(answer?.reply).toContain("moteurs déterministes");
  });

  it("grounds account help in a product action", () => {
    const answer = accountHelp("Je veux changer de profil", "fr");

    expect(answer.action?.href).toBe("/accounts");
  });

  it("detects selectable assistant languages deterministically", () => {
    expect(detectRequestedAssistantLocale("Passe KLYX en anglais")).toBe("en");
    expect(detectRequestedAssistantLocale("Nederlands graag")).toBe("nl");
    expect(languageChangeReply("de")).toContain("Deutsch");
  });
});

describe("assistant engine authority policy", () => {
  it("allows LLM only for the generic information fallback", () => {
    expect(assistantIntentMayUseLlm("information")).toBe(true);
    expect(assistantIntentMayUseLlm("service_need")).toBe(false);
    expect(assistantIntentMayUseLlm("payment_explanation")).toBe(false);
    expect(assistantIntentMayUseLlm("kyc_explanation")).toBe(false);
    expect(assistantIntentMayUseLlm("refund_explanation")).toBe(false);
  });

  it("never grants direct sensitive authority to the assistant", () => {
    expect(assistantMayDirectlyMutateSensitiveAuthority("payment")).toBe(false);
    expect(assistantMayDirectlyMutateSensitiveAuthority("kyc")).toBe(false);
    expect(assistantMayDirectlyMutateSensitiveAuthority("eligibility")).toBe(false);
    expect(assistantMayDirectlyMutateSensitiveAuthority("settlement")).toBe(false);
    expect(assistantMayDirectlyMutateSensitiveAuthority("refund")).toBe(false);
  });

  it("keeps external sensitive providers read-only from the assistant", () => {
    expect(assistantEnginePlan("payment_explanation")).toContainEqual(
      expect.objectContaining({ engine: "stripe", access: "read" })
    );
    expect(assistantEnginePlan("kyc_explanation")).toContainEqual(
      expect.objectContaining({ engine: "sumsub", access: "read" })
    );
  });
});
