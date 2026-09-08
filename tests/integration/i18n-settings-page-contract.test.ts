import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX settings container i18n contract", () => {
  it("wires the focused settings surface to certified page i18n", () => {
    const source = read("app/settings/page.tsx");

    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxSettingsPage");
    expect(source).toContain("KLYX_SETTINGS_PAGE_I18N_16_05");
    expect(source).toContain("KLYX_SETTINGS_PROFILE_DEDUPLICATED");
    expect(source).toContain("KLYX_SETTINGS_SIDEBAR_FROZEN");
    expect(source).toContain("<PhoneSettingsInline />");
    expect(source).toContain("<PhonePrivacyControls />");
    expect(source).toContain("<PhoneAccessHistory />");
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

  it("delegates identity and profile switching while preserving auth, theme and locale", () => {
    const source = read("app/settings/page.tsx");

    expect(source).not.toContain('fetch("/api/profile/me"');
    expect(source).not.toContain("switchAccount");
    expect(source).not.toContain("savingProfile");
    expect(source).not.toContain("setFirstName");
    expect(source).not.toContain("setLastName");
    expect(source).toContain('href="/profile"');
    expect(source).toContain("supabase.auth.updateUser({");
    expect(source).toContain("email: newEmail.trim().toLowerCase()");
    expect(source).toContain("password: newPassword");
    expect(source).toContain("await supabase.auth.signOut()");
    expect(source).toContain("setTheme(value)");
    expect(source).toContain("KLYX_LANGUAGE_OPTIONS");
    expect(source).toContain("onChange={setLocale}");
  });

  it("keeps profile deletion explicit, server-side and isolated from auth identity deletion", () => {
    const source = read("app/settings/page.tsx");
    const api = read("app/api/account/delete/route.ts");

    expect(source).toContain('const DELETE_CONFIRMATION = "SUPPRIMER"');
    expect(source).toContain("deleteConfirmation !== DELETE_CONFIRMATION");
    expect(source).toMatch(/fetch\(\s*["']\/api\/account\/delete["'][\s\S]*?method:\s*["']DELETE["']/);
    expect(source).toContain("resolveKlyxSettingsDeleteErrorKey(result.error)");
    expect(source).toContain('result.deletedScope === "profile"');
    expect(source).toContain('router.replace("/accounts")');
    expect(api).toContain('body.confirmation !== "SUPPRIMER"');
    expect(api).toContain("pending");
    expect(api).toContain("accepted");
    expect(api).toContain("payment_status");
    expect(api).toContain("KLYX_PROFILE_DELETE_NEVER_DELETES_AUTH_IDENTITY");
    expect(api).toContain('deletePlan.scope === "account"');
    expect(api).toContain('const ACCOUNT_DELETION_PAGE = "/delete-account"');
    expect(api).not.toContain("supabaseAdmin.auth.admin.deleteUser(user.id)");
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
