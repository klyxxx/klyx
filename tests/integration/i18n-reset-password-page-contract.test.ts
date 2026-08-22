import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const resetPage = read("app/reset-password/page.tsx");
const resetI18n = read("lib/klyx-reset-password-page-i18n.ts");

describe("KLYX reset-password page-i18n integration", () => {
  it("wires reset-password copy and validation to the active locale", () => {
    expect(resetPage).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(resetPage).toContain('from "@/lib/klyx-reset-password-page-i18n"');
    expect(resetPage).toContain("const { locale } = useKlyxLocale()");
    expect(resetPage).toContain("translateKlyxResetPassword(locale, key)");
    expect(resetPage).toContain('t("passwordTooShort")');
    expect(resetPage).toContain('t("passwordMismatch")');
    expect(resetPage).toContain('t("passwordUpdated")');
  });

  it("keeps reset-password coverage explicit and fail-closed", () => {
    expect(resetI18n).toContain('"fr",\n  "en",\n  "nl",\n  "de",');
    expect(resetI18n).toContain(': "fr"');
    expect(resetI18n).toContain("hasKlyxResetPasswordPageTranslation");
  });

  it("preserves password update and return-to-login behavior", () => {
    expect(resetPage).toContain("password.length < 6");
    expect(resetPage).toContain("password !== confirmPassword");
    expect(resetPage).toContain("supabase.auth.updateUser({ password })");
    expect(resetPage).toContain('router.replace("/login")');
    expect(resetPage).toContain("}, 1500)");
  });
});
