import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/AssistantCommandBar.tsx"),
  "utf8"
);
const compactSource = source.replace(/\s+/g, " ");

describe("KLYX assistant command bar safety and i18n contract", () => {
  it("keeps command submission explicit and preserves the exact API payload", () => {
    expect(source).toContain("onSubmit={submit}");
    expect(compactSource).toContain('fetch("/api/brain/command", {');
    expect(compactSource).toContain('method: "POST"');
    expect(compactSource).toContain('"Content-Type": "application/json"');
    expect(compactSource).toContain('Authorization: `Bearer ${session.access_token}`');
    expect(compactSource).toContain("body: JSON.stringify({ message })");
    expect(source).toContain('from "@/lib/klyx-assistant-message-limits"');
    expect(source).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(source).toContain("maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}");
  });

  it("keeps browser-side execution forbidden and only navigates to server-selected destinations", () => {
    expect(compactSource).toContain('result.mode === "existing_action"');
    expect(compactSource).toContain("router.push(result.action.href)");
    expect(compactSource).toContain("if (result.href)");
    expect(compactSource).toContain("router.push(result.href)");
    expect(source).toContain('router.push("/assistant/actions")');
    expect(source).not.toContain("payment_intents");
    expect(source).not.toContain("checkout.sessions");
    expect(source).not.toContain("refunds.create");
    expect(source).not.toContain("/api/bookings/create");
  });

  it("keeps the composer singular instead of rendering competing suggested actions", () => {
    expect(source).not.toContain("actions.slice");
    expect(source).not.toContain("getKlyxAssistantCommandExamples");
    expect(source).not.toContain("action.label");
  });

  it("preserves explicit photo navigation and progressive voice input", () => {
    expect(compactSource).toContain('router.push("/request/photo")');
    expect(source).toContain("getSpeechRecognitionConstructor");
    expect(source).toContain("getVoiceSettings(locale)");
    expect(source).not.toContain("storage.from(");
  });

  it("does not reflect backend or network error details", () => {
    expect(source).not.toContain("result.error");
    expect(source).not.toContain("error.message");
    expect(source).toContain('t("genericError")');
  });

  it("localizes presentation while leaving user input intact", () => {
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("translateKlyxAssistantCommand");
    expect(compactSource).toContain("const message = value.trim();");
    expect(source).toContain("setValue((current) =>");
  });
});
