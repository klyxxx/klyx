import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider assistant conversation compatibility", () => {
  it("routes the retired provider surface into the single shared conversation", () => {
    const legacyPage = read("app/provider/assistant/page.tsx");
    const assistantPage = read("app/assistant/page.tsx");
    const thread = read("app/components/assistant/AssistantThread.tsx");

    expect(legacyPage).toContain('redirect("/assistant")');
    expect(assistantPage).toContain("<AssistantThread />");
    expect(thread).toContain("const empty = turns.length === 0 && !busy");
    expect(thread).toContain("starterSuggestions(locale)");
    expect(thread).toContain("<AssistantComposer");
    expect(thread).toContain("Gagner environ 100 € samedi");
  });

  it("keeps one restrained KLYX-blue composer with photo, voice and send controls", () => {
    const composer = read("app/components/assistant/AssistantComposer.tsx");

    expect(composer).toContain("#2563EB");
    expect(composer).toContain('aria-label="Photo"');
    expect(composer).toContain("<Camera");
    expect(composer).toContain("<Mic");
    expect(composer).toContain("<ArrowUp");
    expect(composer).not.toContain("purple");
    expect(composer).not.toContain("violet");
  });

  it("does not expose the legacy provider assistant API from the shared UI", () => {
    const legacyPage = read("app/provider/assistant/page.tsx");
    const thread = read("app/components/assistant/AssistantThread.tsx");

    expect(legacyPage).not.toContain('/api/provider/assistant');
    expect(thread).not.toContain('/api/provider/assistant');
    expect(thread).toContain("initialPromptFromLocation()");
  });
});
