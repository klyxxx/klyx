import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider Assistant destination UX", () => {
  it("converges provider entry into the same conversation-first assistant", () => {
    const legacyPage = read("app/provider/assistant/page.tsx");
    const assistantPage = read("app/assistant/page.tsx");
    const thread = read("app/components/assistant/AssistantThread.tsx");

    expect(legacyPage).toContain('redirect("/assistant")');
    expect(assistantPage).toContain("<AssistantThread />");
    expect(thread).toContain("initialPromptFromLocation()");
    expect(thread).toContain('.get("prompt")');
    expect(thread).toContain("Gagner environ 100 € samedi");
    expect(thread).toContain("AssistantComposer");
  });

  it("keeps provider mission prompt handoff on the canonical assistant URL", () => {
    const jobs = read("app/provider/jobs/page.tsx");

    expect(jobs).toContain('"/assistant?prompt="');
    expect(jobs).not.toContain('"/provider/assistant?prompt="');
  });

  it("does not keep a second provider conversation or draft-control UI", () => {
    const legacyPage = read("app/provider/assistant/page.tsx");

    expect(legacyPage).not.toContain('fetch("/api/provider/assistant"');
    expect(legacyPage).not.toContain("pendingDrafts");
    expect(legacyPage).not.toContain("processDraft(");
    expect(legacyPage).not.toContain("<details");
  });
});
