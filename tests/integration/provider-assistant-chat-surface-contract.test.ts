import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX unified assistant conversation surface", () => {
  it("renders the shared thread from the canonical assistant route", () => {
    const page = read("app/assistant/page.tsx");
    const legacyPage = read("app/provider/assistant/page.tsx");

    expect(page).toContain('import AssistantThread from "@/app/components/assistant/AssistantThread";');
    expect(page).toContain("<AssistantThread />");
    expect(legacyPage).toContain('redirect("/assistant")');
  });

  it("keeps all visible assistant turns on one durable Brain conversation", () => {
    const thread = read("app/components/assistant/AssistantThread.tsx");

    expect(thread).toContain('fetch("/api/brain/converse"');
    expect(thread).toContain("LEGACY_COMMAND_PREFLIGHT_ENABLED = false");
    expect(thread).toContain('url.searchParams.set("conversation", nextConversationId)');
    expect(thread).toContain("<AssistantComposer");
    expect(thread).not.toContain('fetch("/api/provider/assistant"');
  });
});
