import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

const legacyPage = read("app/provider/assistant/page.tsx");
const thread = read("app/components/assistant/AssistantThread.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");

describe("unified assistant localized surface", () => {
  it("keeps the provider route as a compatibility redirect to the single assistant", () => {
    expect(legacyPage).toContain('redirect("/assistant")');
    expect(legacyPage).not.toContain('fetch("/api/provider/assistant"');
  });

  it("localizes the unified assistant surface", () => {
    expect(thread).toContain("useKlyxLocale()");
    expect(thread).toContain("translateKlyxAssistantCommand");
    expect(thread).toContain("translateKlyxAssistantHome");
    expect(composer).toContain("placeholder={placeholder}");
    expect(composer).toContain("maxLength={KLYX_ASSISTANT_MESSAGE_MAX_LENGTH}");
  });

  it("sends visible turns through one durable conversation endpoint", () => {
    expect(thread).toContain('fetch("/api/brain/converse"');
    expect(thread).toContain("LEGACY_COMMAND_PREFLIGHT_ENABLED = false");
    expect(thread).not.toContain('fetch("/api/provider/assistant"');
  });
});
