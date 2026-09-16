import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

const legacyPage = read("app/provider/assistant/page.tsx");
const assistantPage = read("app/assistant/page.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");

describe("KLYX unified assistant visual contract", () => {
  it("keeps one rendered assistant surface", () => {
    expect(legacyPage).toContain('redirect("/assistant")');
    expect(assistantPage).toContain("<AssistantThread />");
  });

  it("uses the exact KLYX blue without provider-specific purple accents", () => {
    expect(composer).toContain("#2563EB");
    expect(composer).toContain("bg-[#2563EB]");
    expect(composer).toContain("focus-within:border-[#2563EB]/40");
    expect(composer).not.toContain("violet");
    expect(composer).not.toContain("indigo");
    expect(composer).not.toContain("purple");
  });
});
