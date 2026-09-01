import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX settings/profile server boundary", () => {
  it("keeps identity editing on Profile and out of Settings", () => {
    const settings = read("app/settings/page.tsx");
    const profile = read("app/profile/page.tsx");

    expect(settings).toContain("KLYX_SETTINGS_PROFILE_DEDUPLICATED");
    expect(settings).not.toMatch(/\.from\(\s*["']profiles["']\s*\)[\s\S]*?\.update\(/);
    expect(settings).not.toContain('fetch("/api/profile/me"');
    expect(settings).not.toContain("savingProfile");
    expect(settings).not.toContain("setFirstName");
    expect(settings).not.toContain("setLastName");
    expect(settings).not.toContain("switchAccount");

    expect(profile).toMatch(
      /fetch\(\s*["']\/api\/profile\/me["'][\s\S]*?cache:\s*["']no-store["']/
    );
    expect(profile).toMatch(
      /fetch\(\s*["']\/api\/profile\/me["'][\s\S]*?method:\s*["']PATCH["']/
    );
    expect(profile).toMatch(
      /JSON\.stringify\(\{[\s\S]*?firstName,[\s\S]*?lastName,[\s\S]*?city,[\s\S]*?age:/
    );
  });

  it("preserves unrelated authenticated Settings boundaries", () => {
    const settings = read("app/settings/page.tsx");

    expect(settings).toContain("supabase.auth.updateUser({");
    expect(settings).toContain("email: newEmail.trim().toLowerCase()");
    expect(settings).toContain("password: newPassword");
    expect(settings).toMatch(
      /fetch\(\s*["']\/api\/account\/delete["'][\s\S]*?method:\s*["']DELETE["']/
    );
  });

  it("keeps the server profile API ownership checks and validation in force", () => {
    const api = read("app/api/profile/me/route.ts");

    expect(api).toContain('.eq("id", activeProfile.id)');
    expect(api).toContain('.eq("owner_user_id", user.id)');
    expect(api).toContain("L’âge doit être compris entre 18 et 100 ans.");
    expect(api).toContain("Le prénom, le nom et la ville sont obligatoires.");
  });
});
