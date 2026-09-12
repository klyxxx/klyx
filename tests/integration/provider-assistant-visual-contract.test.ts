import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const legacyPage = read("app/provider/assistant/page.tsx");
const composer = read("app/components/assistant/AssistantComposer.tsx");

describe("KLYX provider assistant visual compatibility contract", () => {
  it("keeps the legacy destination as a redirect instead of a duplicate provider UI", () => {
    expect(legacyPage).toContain('redirect("/assistant")');
    expect(legacyPage).not.toContain('fetch("/api/provider/assistant"');
    expect(legacyPage).not.toContain("processDraft(");
  });

  it("keeps the canonical assistant composer on exact KLYX blue without purple accents", () => {
    expect(composer).toContain('data-testid="assistant-composer"');
    expect(composer).toContain("#2563EB");
    expect(composer).toContain("bg-[#2563EB]");
    expect(composer).toContain("focus-within:border-[#2563EB]/40");
    expect(composer).not.toContain("bg-blue-600");
    expect(composer).not.toContain("text-blue-600");
    expect(composer).not.toContain("violet");
    expect(composer).not.toContain("indigo");
    expect(composer).not.toContain("purple");
  });

  it("keeps transactional presentation out of the compatibility page", () => {
    expect(legacyPage).not.toContain("text-emerald-600");
    expect(legacyPage).not.toContain("text-red-600");
    expect(legacyPage).not.toContain("payment_intent");
    expect(legacyPage).not.toContain("/api/stripe");
  });
});
