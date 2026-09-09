import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const commandBar = read("app/components/AssistantCommandBar.tsx");
const thread = read("app/components/assistant/AssistantThread.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");
const turns = read("app/components/assistant/AssistantTurns.tsx");
const compactThread = thread.replace(/\s+/g, " ");

describe("KLYX assistant thread safety and i18n contract", () => {
  it("keeps command submission explicit and preserves the command API payload", () => {
    expect(commandBar).toContain("<AssistantThread />");
    expect(compactThread).toContain('fetch("/api/brain/command", {');
    expect(compactThread).toContain('method: "POST"');
    expect(compactThread).toContain('"Content-Type": "application/json"');
    expect(compactThread).toContain('Authorization: `Bearer ${session.access_token}`');
    expect(compactThread).toContain("body: JSON.stringify({ message })");
    expect(composer).toContain('from "@/lib/klyx-assistant-message-limits"');
    expect(composer).toContain("KLYX_ASSISTANT_MESSAGE_MAX_LENGTH");
    expect(composer).toContain("maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}");
  });

  it("keeps browser-side execution forbidden and surfaces server-selected actions in the thread", () => {
    expect(compactThread).toContain('command.mode === "existing_action"');
    expect(thread).toContain("command.action?.title?.trim()");
    expect(thread).toContain("command.action?.description?.trim()");
    expect(thread).toContain("href: command.action.href");
    expect(thread).toContain("label: command.action.label");
    expect(turns).toContain("href={action.href}");
    expect(turns).toContain("{action.label}");
    expect(thread).not.toContain("router.push(command.action.href)");
    expect(thread).not.toContain("payment_intents");
    expect(thread).not.toContain("checkout.sessions");
    expect(thread).not.toContain("refunds.create");
    expect(thread).not.toContain("/api/bookings/create");
  });

  it("keeps no-action results conversational instead of redirecting", () => {
    expect(compactThread).toContain('command.mode === "no_action"');
    expect(thread).toContain('const content = t("noPendingAction")');
    expect(thread).toContain("setLiveAnnouncement(content)");
    expect(thread).not.toContain('router.push("/assistant/actions")');
  });

  it("keeps one composer with subtle suggestions rather than competing action surfaces", () => {
    expect(thread).toContain("<AssistantComposer");
    expect(thread).toContain("<SuggestionGroup");
    expect(thread).not.toContain("actions.slice");
    expect(thread).not.toContain("getKlyxAssistantCommandExamples");
  });

  it("preserves explicit photo navigation and progressive voice input", () => {
    expect(compactThread).toContain('onPhoto={() => router.push("/request/photo")}');
    expect(composer).toContain("speechRecognitionConstructor");
    expect(composer).toContain("voiceCopy(locale)");
    expect(composer).toContain("nextValue.slice(0, KLYX_ASSISTANT_MESSAGE_MAX_LENGTH)");
    expect(composer).not.toContain("storage.from(");
  });

  it("maps HTTP failures to localized safe copy without reflecting backend details", () => {
    expect(thread).toContain('status === 400');
    expect(thread).toContain('status === 413');
    expect(thread).toContain('status === 429');
    expect(thread).toContain('t("invalidMessageError")');
    expect(thread).toContain('t("payloadTooLargeError")');
    expect(thread).toContain('t("rateLimitedError")');
    expect(thread).toContain('t("genericError")');
    expect(thread).not.toContain("result.error");
  });

  it("localizes presentation while leaving user input intact", () => {
    expect(thread).toContain("useKlyxLocale()");
    expect(thread).toContain("translateKlyxAssistantCommand");
    expect(thread).toContain("const message = rawMessage.trim();");
    expect(thread).toContain('t("noPendingAction")');
    expect(thread).toContain("setValue(suggestion.value)");
  });
});
