import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX profiles destination UX contract", () => {
  it("keeps the landing focused on profiles and one create action", () => {
    const source = read("app/accounts/page.tsx");

    expect(source).toContain('t("myProfiles")');
    expect(source).toContain('t("profilesCount"');
    expect(source).toContain('onClick={() => openCreateForm()}');
    expect(source).toContain('t("addProfile")');
    expect(source).not.toContain("function AccountStatCard");
    expect(source).not.toContain("klyx-accounts-quick-create");
    expect(source).not.toContain("clientProfiles");
    expect(source).not.toContain("providerProfiles");
  });

  it("asks for the profile role only inside the create dialog", () => {
    const source = read("app/accounts/page.tsx");

    expect(source).toContain('{formMode === "create" && (');
    expect(source).toContain('<AccountTypeButton\n                      type="client"');
    expect(source).toContain('<AccountTypeButton\n                      type="provider"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('className="fixed inset-0 z-[70]');
  });

  it("uses the exact KLYX blue and leaves violet out of the destination", () => {
    const source = read("app/accounts/page.tsx");

    expect(source).toContain("bg-blue-600");
    expect(source).toContain("focus:border-blue-600");
    expect(source).not.toContain("violet-");
    expect(source).not.toContain("indigo-");
  });

  it("preserves the existing profile business operations", () => {
    const source = read("app/accounts/page.tsx");

    expect(source).toContain("getProfilesState()");
    expect(source).toContain("createProfile({");
    expect(source).toContain("updateProfile(profileId");
    expect(source).toContain("switchAccount(profileId)");
    expect(source).toContain("deleteProfile(profile.id)");
    expect(source).toContain('supabase.storage.from(AVATAR_BUCKET)');
  });
});
