import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/assistant/page.tsx"),
  "utf8"
);

describe("KLYX unified assistant home contract", () => {
  it("keeps the client home as one conversational surface", () => {
    expect(source).toContain("<ClientRouteGuard>");
    expect(source).toContain("Que puis-je organiser pour vous ?");
    expect(source).toContain("<AssistantCommandBar />");
    expect(source).not.toContain("/api/brain/actions");
    expect(source).not.toContain("<AssistantBrief />");
    expect(source).not.toContain("<ProactiveAssistantPanel />");
  });

  it("removes marketplace, provider and legacy brain shortcuts from the client home", () => {
    for (const href of [
      "/assistant/market",
      "/requests",
      "/search",
      "/provider/jobs",
      "/provider/assistant",
      "/brain",
    ]) {
      expect(source).not.toContain(`href="${href}"`);
    }
  });

  it("states the editable-summary and explicit-confirmation interaction contract", () => {
    expect(source).toContain("demande uniquement ce qui manque");
    expect(source).toContain("résumé modifiable");
    expect(source).toContain("confirmer chaque action importante");
  });

  it("forbids invented price or availability and sensitive autonomous actions", () => {
    expect(source).toContain("ne suppose jamais un prix ou une disponibilité");
    expect(source).toContain("sans votre confirmation");
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });
});
