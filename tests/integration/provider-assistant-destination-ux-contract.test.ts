import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX unified assistant destination UX", () => {
  it("keeps the provider compatibility URL pointed at the single assistant", () => {
    const legacyPage = read("app/provider/assistant/page.tsx");
    expect(legacyPage).toContain('redirect("/assistant")');
  });

  it("keeps conversation-first interaction and explicit confirmation boundaries", () => {
    const thread = read("app/components/assistant/AssistantThread.tsx");
    const composer = read("app/components/assistant/AssistantComposer.tsx");

    expect(thread).toContain('fetch("/api/brain/converse"');
    expect(thread).toContain("LEGACY_CONFIRMATION_BOUNDARY");
    expect(thread).toContain("LEGACY_COMMAND_PREFLIGHT_ENABLED = false");
    expect(composer).toContain("onSubmit={submit}");
    expect(composer).toContain("placeholder={placeholder}");
    expect(thread).not.toContain("/api/stripe");
    expect(thread).not.toContain("/api/bookings");
  });
});
