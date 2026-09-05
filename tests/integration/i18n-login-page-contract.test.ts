import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const loginPage = read("app/login/page.tsx");
const loginI18n = read("lib/klyx-auth-page-i18n.ts");
const playwrightConfig = read("playwright.config.ts");

describe("KLYX login page-i18n integration", () => {
  it("wires login copy and validation feedback to the active locale", () => {
    expect(loginPage).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(loginPage).toContain('from "@/lib/klyx-auth-page-i18n"');
    expect(loginPage).toContain("const { locale } = useKlyxLocale()");
    expect(loginPage).toContain("translateKlyxLogin(locale, key)");
    expect(loginPage).toContain('t("invalidCredentials")');
    expect(loginPage).toContain('t("captchaFailed")');
    expect(loginPage).toContain('t("resetSent")');
  });

  it("keeps login page coverage explicit and fail-closed", () => {
    expect(loginI18n).toContain(
      'KLYX_LOGIN_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de", "es"]'
    );
    expect(loginI18n).toContain(': "fr"');
    expect(loginI18n).toContain("hasKlyxLoginPageTranslation");
  });

  it("preserves multi-profile and password-reset contracts", () => {
    expect(loginPage).toContain("KLYX_MULTI_PROFILE_LOGIN_13_88");
    expect(loginPage).toContain("KLYX_LOGIN_PROFILE_CONTINUITY_13_88");
    expect(loginPage).toContain("KLYX_PASSWORD_RESET_FEEDBACK_13_88");
    expect(loginPage).toContain("KLYX_LOGIN_NO_PASSWORD_SWITCH_13_88");
    expect(loginPage).toContain('router.replace("/dashboard")');
    expect(loginPage).toContain('`${window.location.origin}/reset-password`');
  });

  it("keeps the historical browser suite on a deterministic French locale", () => {
    expect(playwrightConfig).toContain('locale:\n      "fr-BE"');
  });
});
