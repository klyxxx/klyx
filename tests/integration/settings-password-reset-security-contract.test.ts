import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("settings password reset security contract", () => {
  it("routes authenticated password changes through the protected recovery pipeline", () => {
    const settings = read("app/settings/page.tsx");
    const resetPage = read("app/reset-password/page.tsx");
    const settingsI18n = read("lib/klyx-settings-page-i18n.ts");

    expect(settings).toContain("KLYX_SETTINGS_PASSWORD_RECOVERY_20260909");
    expect(settings).toContain('setEmail(user.email ?? "")');
    expect(settings).toContain(
      "const normalizedEmail = email.trim().toLowerCase()"
    );
    expect(settings).toContain("supabase.auth.resetPasswordForEmail(");
    expect(settings).toContain(
      "redirectTo: `${window.location.origin}/reset-password`"
    );
    expect(settings).toContain('action="password-reset"');
    expect(settings).toContain("AUTH_TURNSTILE_ENABLED");
    expect(settings).toContain("captchaToken: AUTH_TURNSTILE_ENABLED");
    expect(settingsI18n).toContain(
      'updatePassword: "Changer mon mot de passe"'
    );

    expect(settings).not.toContain("const [newPassword");
    expect(settings).not.toContain("const [confirmPassword");
    expect(settings).not.toContain("password: newPassword");
    expect(settings).not.toMatch(
      /localStorage\.(?:setItem|getItem)\([^\n]*password/i
    );

    expect(resetPage).toContain("supabase.auth.updateUser({ password })");
  });
});
