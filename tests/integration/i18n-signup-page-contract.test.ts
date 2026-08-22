import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const signupPage = read("app/signup/page.tsx");
const signupI18n = read("lib/klyx-signup-page-i18n.ts");

describe("KLYX signup page-i18n integration", () => {
  it("wires signup copy and validation feedback to the active locale", () => {
    expect(signupPage).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(signupPage).toContain('from "@/lib/klyx-signup-page-i18n"');
    expect(signupPage).toContain("const { locale } = useKlyxLocale()");
    expect(signupPage).toContain("translateKlyxSignup(locale, key)");
    expect(signupPage).toContain('t("invalidForm")');
    expect(signupPage).toContain('t("captchaRequired")');
    expect(signupPage).toContain('t("captchaFailed")');
    expect(signupPage).toContain('t("accountCreated")');
  });

  it("keeps signup page coverage explicit and fail-closed", () => {
    expect(signupI18n).toContain(
      'KLYX_SIGNUP_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"]'
    );
    expect(signupI18n).toContain(': "fr"');
    expect(signupI18n).toContain("hasKlyxSignupPageTranslation");
  });

  it("preserves role, onboarding and captcha boundaries", () => {
    expect(signupPage).toContain("KLYX_SIGNUP_ROLE_CONTINUITY_14_02");
    expect(signupPage).toContain("KLYX_SIGNUP_NEXT_STEP_14_02");
    expect(signupPage).toContain('account_type: accountType');
    expect(signupPage).toContain('router.replace("/onboarding")');
    expect(signupPage).toContain('`${window.location.origin}/onboarding`');
    expect(signupPage).toContain('action="signup"');
  });
});
