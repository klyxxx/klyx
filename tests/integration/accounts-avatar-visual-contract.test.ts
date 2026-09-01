import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX accounts avatar visual contract", () => {
  it("keeps one focused profile-management surface", () => {
    const page = read("app/accounts/page.tsx");
    const theme = read("app/klyx-accounts-visual.css");
    const layout = read("app/accounts/layout.tsx");

    expect(page).toContain("klyx-accounts-overview");
    expect(page).toContain("klyx-accounts-quick-create");
    expect(theme).toContain(".klyx-accounts-overview");
    expect(theme).toContain(".klyx-accounts-quick-create");
    expect(theme).toContain("display: none");
    expect(theme).toContain("#2563eb");
    expect(layout).toContain("klyx-accounts-page");
  });

  it("preserves avatar preview, limits and profile mutations", () => {
    const page = read("app/accounts/page.tsx");

    expect(page).toContain('type="file"');
    expect(page).toContain('accept="image/*"');
    expect(page).toContain("URL.createObjectURL");
    expect(page).toContain("URL.revokeObjectURL");
    expect(page).toContain("MAX_AVATAR_BYTES");
    expect(page).toContain("/api/profiles");
    expect(page).toContain("/api/profiles/active");
  });

  it("archives local avatar states without saving the fixture", () => {
    const visual = read("tests/e2e/accounts-avatar-visual-evidence.spec.ts");

    expect(visual).toContain("SYNTHETIC_AVATAR");
    expect(visual).toContain("setInputFiles");
    expect(visual).toContain("accounts-profiles-desktop");
    expect(visual).toContain("accounts-avatar-preview-desktop");
    expect(visual).toContain("accounts-avatar-preview-mobile");
    expect(visual).toContain("accounts-profiles-mobile");
    expect(visual).not.toContain("page.click");
    expect(visual).not.toContain("/api/profiles");
  });
});
