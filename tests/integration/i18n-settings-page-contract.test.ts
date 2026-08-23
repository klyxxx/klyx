import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX settings container i18n contract", () => {
  it("wires only the settings parent surface to certified page i18n", () => {
    const source = read("app/settings/page.tsx");

    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxSettingsPage");
    expect(source).toContain("KLYX_SETTINGS_PAGE_I18N_16_05");
    expect(source).toContain("KLYX_SETTINGS_PROFILE_SERVER_BOUNDARY_16_04");
    expect(source).toContain("<PhoneSettingsInline />");
    expect(source).toContain("<PhonePrivacyControls />");
  });

  it("keeps phone modules outside the settings-container translation batch", () => {
    for (const file of [
      "app/settings/PhoneSettingsInline.tsx",
      "app/settings/PhonePrivacyControls.tsx",
      "app/settings/PhoneAccessHistory.tsx",
    ]) {
      expect(read(file)).not.toContain("klyx-settings-page-i18n");
    }
  });

  it("preserves profile, auth, theme, locale and profile-switch boundaries", () => {
    const source = read("app/settings/page.tsx");

    expect(source).toMatch(/fetch\(\s*["']\/api\/profile\/me["'][\s\S]*?cache:\s*["']no-store["']/);
    expect(source).toMatch(/fetch\(\s*["']\/api\/profile\/me["'][\s\S]*?method:\s*["']PATCH["']/);
    expect(source).toContain("currentBody.profile.city");
    expect(source).toContain("currentBody.profile.age");
    expect(source).toContain("supabase.auth.updateUser({");
    expect(source).toContain("email: newEmail.trim().toLowerCase()");
    expect(source).toContain("password: newPassword");
    expect(source).toContain("await supabase.auth.signOut()");
    expect(source).toContain("setTheme(value)");
    expect(source).toContain("KLYX_LANGUAGE_OPTIONS");
    expect(source).toContain("onChange={setLocale}");
    expect(source).toContain("await switchAccount(account.id)");
  });

  it("keeps account deletion explicit, server-side and fail-closed", () => {
    const source = read("app/settings/page.tsx");
    const api = read("app/api/account/delete/route.ts");

    expect(source).toContain('const DELETE_CONFIRMATION = "SUPPRIMER"');
    expect(source).toContain("deleteConfirmation !== DELETE_CONFIRMATION");
    expect(source).toMatch(/fetch\(\s*["']\/api\/account\/delete["'][\s\S]*?method:\s*["']DELETE["']/);
    expect(source).toContain("resolveKlyxSettingsDeleteErrorKey(result.error)");
    expect(source).toContain('router.replace("/signup?deleted=1")');
    expect(api).toContain('body.confirmation !== "SUPPRIMER"');
    expect(api).toContain("pending");
    expect(api).toContain("accepted");
    expect(api).toContain("payment_status");
    expect(api).toContain("supabaseAdmin.auth.admin.deleteUser(user.id)");
  });

  it("does not reflect arbitrary SDK or server error messages from the parent page", () => {
    const source = read("app/settings/page.tsx");

    expect(source).not.toContain("error instanceof Error");
    expect(source).not.toContain("error.message");
    expect(source).toContain('failure("emailUpdateFailed")');
    expect(source).toContain('failure("passwordUpdateFailed")');
    expect(source).toContain('failure("deleteFailed")');
  });
});
