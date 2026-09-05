import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "app/provider/assistant/page.tsx"),
  "utf8"
);

describe("KLYX provider assistant visual contract", () => {
  it("keeps explicit provider control and draft actions intact", () => {
    expect(page).toContain('{t("surfaceDescription")}');
    expect(page).toContain('{t("controlNote")}');
    expect(page).toContain('placeholder={t("placeholder")}');
    expect(page).toContain('fetch("/api/provider/assistant"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('action: "apply" | "discard"');
    expect(page).toContain('processDraft(draft.id, "apply")');
    expect(page).toContain('processDraft(draft.id, "discard")');
  });

  it("uses the exact KLYX blue without the previous purple accents", () => {
    expect(page).toContain("KLYX_PROVIDER_ASSISTANT_VISUAL_2026_08_31");
    expect(page).toContain("#2563EB");
    expect(page).toContain("bg-[#2563EB]");
    expect(page).toContain("text-[#2563EB]");
    expect(page).toContain("focus-within:border-[#2563EB]/45");
    expect(page).not.toContain("bg-blue-600");
    expect(page).not.toContain("text-blue-600");
    expect(page).not.toContain("violet");
    expect(page).not.toContain("indigo");
    expect(page).not.toContain("purple");
  });

  it("keeps transactional feedback semantic rather than branded", () => {
    expect(page).toContain("text-emerald-600");
    expect(page).toContain("text-red-600");
  });
});
