import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX profile page i18n contract", () => {
  it("wires the profile page to certified page i18n without locale-triggered refetch", () => {
    const source = read("app/profile/page.tsx");

    expect(source).toContain('useKlyxLocale');
    expect(source).toContain('translateKlyxProfilePage');
    expect(source).toContain('KLYX_PROFILE_PAGE_I18N_16_03');
    expect(source).toContain('const loadProfile = useCallback');
    expect(source).toMatch(/const loadProfile = useCallback\([\s\S]*?\n  \}, \[\]\);/);
    expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*?void loadProfile\(\);[\s\S]*?\}, \[loadProfile\]\);/);
  });

  it("preserves the existing profile read, save and avatar write boundaries", () => {
    const source = read("app/profile/page.tsx");

    expect(source).toContain('fetch("/api/profile/me", {');
    expect(source).toMatch(/fetch\("\/api\/profile\/me", \{[\s\S]*?method: "PATCH"/);
    expect(source).toMatch(/JSON\.stringify\(\{[\s\S]*?firstName,[\s\S]*?lastName,[\s\S]*?city,[\s\S]*?age: age\.trim\(\) === "" \? null : Number\(age\)/);
    expect(source).toMatch(/fetch\("\/api\/profile\/avatar", \{[\s\S]*?method: "POST"[\s\S]*?body: formData/);
    expect(source).toContain('["image/jpeg", "image/png", "image/webp"]');
    expect(source).toContain('file.size > 5 * 1024 * 1024');
    expect(source).toContain('href="/provider"');
    expect(source).toContain('KLYX_AI_FIRST_PROFILE_15_03');
  });

  it("never reflects arbitrary API error text into the profile UI", () => {
    const source = read("app/profile/page.tsx");

    expect(source).toContain('resolveKlyxProfilePageApiErrorKey(body.error, "loadFailed")');
    expect(source).toContain('resolveKlyxProfilePageApiErrorKey(body.error, "uploadFailed")');
    expect(source).toContain('resolveKlyxProfilePageApiErrorKey(body.error, "saveFailed")');
    expect(source).not.toContain('throw new Error(body.error');
    expect(source).not.toContain('error instanceof Error');
  });

  it("keeps unexpected server failures behind the secure API error boundary", () => {
    const profileApi = read("app/api/profile/me/route.ts");
    const avatarApi = read("app/api/profile/avatar/route.ts");

    expect(profileApi).toContain('secureApiErrorResponse');
    expect(profileApi).toContain('KLYX_PROFILE_READ_FAILED');
    expect(profileApi).toContain('KLYX_PROFILE_UPDATE_FAILED');
    expect(avatarApi).toContain('secureApiErrorResponse');
    expect(avatarApi).toContain('KLYX_PROFILE_AVATAR_UPLOAD_FAILED');
  });
});
