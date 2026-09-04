import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX photo request visual contract", () => {
  it("keeps the real photo preview and privacy controls intact", () => {
    const page = read("app/request/photo/page.tsx");

    expect(page).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(page).toContain('alt="Aperçu du problème"');
    expect(page).toContain("KLYX_ASSISTANT_PHOTO_ATTACHMENT_RENDER_16_07");
    expect(page).toContain(
      'className="max-h-[420px] max-w-full rounded-[18px] object-contain"'
    );
    expect(page).toContain('alt="Photo envoyée à KLYX"');
    expect(page).toContain('aria-label="Supprimer la photo"');
    expect(page).toContain("client-service-photos");
    expect(page).toContain("Autoriser l’analyse visuelle IA de cette photo");
    expect(page).not.toContain('className="h-44 w-full object-contain"');
    expect(page).not.toContain('rounded-[22px] border border-border bg-black');
  });

  it("uses the single KLYX blue instead of legacy purple accents", () => {
    const page = read("app/request/photo/page.tsx");

    expect(page).toContain("#2563EB");
    expect(page).not.toContain("violet");
    expect(page).not.toContain("purple");
    expect(page).not.toContain("gradient");
  });

  it("archives only a synthetic local preview in visual evidence", () => {
    const visual = read("tests/e2e/photo-request-visual-evidence.spec.ts");

    expect(visual).toContain("SYNTHETIC_PHOTO");
    expect(visual).toContain("setInputFiles");
    expect(visual).toContain("klyx-safe-visual-fixture.png");
    expect(visual).not.toContain("/api/requests/photo");
    expect(visual).not.toContain("client-service-photos");
    expect(visual).toContain("photo-request-preview-desktop");
    expect(visual).toContain("photo-request-preview-mobile");
  });
});
