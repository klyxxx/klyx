import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX settings profile server boundary", () => {
  it("keeps settings profile writes behind the existing profile API", () => {
    const settings = read("app/settings/page.tsx");

    expect(settings).toContain("KLYX_SETTINGS_PROFILE_SERVER_BOUNDARY_16_04");
    expect(settings).not.toMatch(/\.from\(\s*["']profiles["']\s*\)[\s\S]*?\.update\(/);
    expect(settings).toMatch(/fetch\(\s*["']\/api\/profile\/me["'][\s\S]*?cache:\s*["']no-store["']/);
    expect(settings).toMatch(/fetch\(\s*["']\/api\/profile\/me["'][\s\S]*?method:\s*["']PATCH["']/);
  });

  it("preserves city and age when settings edits only the current profile name", () => {
    const settings = read("app/settings/page.tsx");

    expect(settings).toMatch(/currentBody\.profile\.city/);
    expect(settings).toMatch(/currentBody\.profile\.age/);
    expect(settings).toMatch(/JSON\.stringify\(\{[\s\S]*?firstName:[\s\S]*?lastName:[\s\S]*?city:[\s\S]*?age:/);
  });

  it("preserves unrelated authenticated settings boundaries", () => {
    const settings = read("app/settings/page.tsx");

    expect(settings).toContain("supabase.auth.updateUser({");
    expect(settings).toContain("email: newEmail.trim().toLowerCase()");
    expect(settings).toContain("password: newPassword");
    expect(settings).toMatch(/fetch\(\s*["']\/api\/account\/delete["'][\s\S]*?method:\s*["']DELETE["']/);
    expect(settings).toContain("await switchAccount(account.id)");
  });

  it("keeps the server profile API ownership checks and validation in force", () => {
    const api = read("app/api/profile/me/route.ts");

    expect(api).toContain('.eq("id", activeProfile.id)');
    expect(api).toContain('.eq("owner_user_id", user.id)');
    expect(api).toContain("L’âge doit être compris entre 18 et 100 ans.");
    expect(api).toContain("Le prénom, le nom et la ville sont obligatoires.");
  });
});
