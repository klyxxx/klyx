import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/assistant/page.tsx"),
  "utf8"
);
const copy = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-assistant-home-i18n.ts"),
  "utf8"
);

describe("KLYX Assistant-first home contract", () => {
  it("renders only the protected central thread inside the merged shell", () => {
    expect(source).toContain("<ClientRouteGuard>");
    expect(source).toContain("<AssistantThread />");
    expect(source).not.toContain("AssistantHomeResume");
    expect(source).not.toContain("Bell");
    expect(source).not.toContain('href="/notifications"');
    expect(source).not.toContain("AssistantBrief");
    expect(source).not.toContain("ProactiveAssistantPanel");
  });

  it("uses the validated D01 headline", () => {
    expect(copy).toContain('organizeTitle: "Que puis-je organiser pour vous ?"');
  });

  it("keeps the page itself mutation-free", () => {
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });
});
