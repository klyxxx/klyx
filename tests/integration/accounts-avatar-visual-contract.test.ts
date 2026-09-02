import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX accounts avatar visual contract", () => {
  it("keeps one focused profile-management surface", () => {
    const page = read("app/accounts/page.tsx");
    const layout = read("app/accounts/layout.tsx");

    expect(page).toContain('t("myProfiles")');
    expect(page).toContain('onClick={() => openCreateForm()}');
    expect(page).toContain('t("addProfile")');
    expect(page).not.toContain("function AccountStatCard");
    expect(page).not.toContain("klyx-accounts-overview");
    expect(page).not.toContain("klyx-accounts-quick-create");
    expect(page).not.toContain("violet-");
    expect(layout).not.toContain("klyx-accounts-visual.css");
  });

  it("preserves avatar preview, limits and profile mutations", () => {
    const page = read("app/accounts/page.tsx");

    expect(page).toContain('type="file"');
    expect(page).toContain('accept="image/*"');
    expect(page).toContain("URL.createObjectURL");
    expect(page).toContain("URL.revokeObjectURL");
    expect(page).toContain("MAX_AVATAR_SIZE");
    expect(page).toContain("MAX_PROFILES");
    expect(page).toContain("createProfile");
    expect(page).toContain("updateProfile");
    expect(page).toContain("switchAccount");
    expect(page).toContain("deleteProfile");
  });

  it("archives landing, avatar and creation states without saving the fixture", () => {
    const visual = read("tests/e2e/accounts-avatar-visual-evidence.spec.ts");

    expect(visual).toContain("SYNTHETIC_AVATAR");
    expect(visual).toContain("setInputFiles");
    expect(visual).toContain("accounts-profiles-desktop");
    expect(visual).toContain("accounts-avatar-preview-desktop");
    expect(visual).toContain("accounts-avatar-preview-mobile");
    expect(visual).toContain("accounts-profiles-mobile");
    expect(visual).toContain("accounts-create-profile-mobile");
    expect(visual).not.toContain("page.click");
    expect(visual).not.toContain("/api/profiles");
  });
});
