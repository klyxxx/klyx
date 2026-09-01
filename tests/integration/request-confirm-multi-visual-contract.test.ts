import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX multi-request confirmation visual contract", () => {
  it("uses the single KLYX blue without legacy purple decoration", () => {
    const page = read("app/request/confirm-multi/page.tsx");

    expect(page).toContain("bg-[#2563EB]");
    expect(page).toContain("text-[#2563EB]");
    expect(page).not.toContain("violet");
    expect(page).not.toContain("purple");
    expect(page).not.toContain("gradient");
  });

  it("preserves publication and confirmation business rules", () => {
    const page = read("app/request/confirm-multi/page.tsx");

    expect(page).toContain("/api/brain/market-publish-multi");
    expect(page).toContain("conversationId");
    expect(page).toContain("confirmationId");
    expect(page).toContain("multiSlot !==");
    expect(page).toContain("parsed.slots.length <");
    expect(page).toContain("confirmed:");
    expect(page).toContain(
      "Aucune réservation et aucun paiement ne seront exécutés automatiquement."
    );
  });

  it("archives the complete desktop and mobile summary without publishing", () => {
    const visual = read(
      "tests/e2e/request-confirm-multi-visual-evidence.spec.ts"
    );

    expect(visual).toContain("request-confirm-multi-desktop");
    expect(visual).toContain("request-confirm-multi-mobile");
    expect(visual).toContain("VISUAL_SCHEDULE");
    expect(visual).not.toContain("page.click");
    expect(visual).not.toContain("/api/brain/market-publish-multi");
  });
});
