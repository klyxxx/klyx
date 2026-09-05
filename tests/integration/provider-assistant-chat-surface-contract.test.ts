import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider assistant conversation surface", () => {
  it("removes the oversized empty conversation gap and puts the composer in the primary surface", () => {
    const page = read("app/provider/assistant/page.tsx");

    expect(page).toContain("KLYX_PROVIDER_ASSISTANT_CHAT_SURFACE_2026_09_04");
    expect(page).toContain("const hasConversation = messages.length > 0 || loading");
    expect(page).toContain("const composer = (");
    expect(page).toContain("mx-auto mt-7 w-full max-w-2xl");
    expect(page).toContain("sticky bottom-3 z-20");
    expect(page).not.toContain('className="mt-10 min-h-[22rem]"');
  });

  it("keeps the provider assistant as one restrained KLYX-blue chat surface", () => {
    const page = read("app/provider/assistant/page.tsx");

    expect(page).toContain("#2563EB");
    expect(page).toContain("rounded-[28px]");
    expect(page).toContain("max-w-3xl");
    expect(page).not.toContain("text-blue-400");
    expect(page).not.toContain("hover:bg-blue-700");
    expect(page).not.toContain("gradient");
    expect(page).not.toContain("purple");
    expect(page).not.toContain("violet");
  });

  it("preserves the existing provider assistant API and confirmation boundaries", () => {
    const page = read("app/provider/assistant/page.tsx");

    expect(page.match(/fetch\("\/api\/provider\/assistant"/g)?.length).toBe(3);
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('action: "apply" | "discard"');
    expect(page).toContain('t("controlNote")');
  });
});
