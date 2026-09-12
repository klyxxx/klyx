import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("KLYX assistant-first settings security contract", () => {
  it("keeps only phone and canonical language as primary settings", () => {
    const settings = read("app/settings/page.tsx");
    const otherToggle = settings.indexOf('data-testid="settings-other-toggle"');

    expect(settings).toContain("KLYX_SETTINGS_ASSISTANT_FIRST_20260912");
    expect(otherToggle).toBeGreaterThan(0);
    expect(settings).toContain('"Autres paramètres"');
    expect(settings).toContain("<PhoneSettingsInline />");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.find");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).toContain('role="radiogroup"');
    expect(settings).toContain('role="radio"');
    expect(settings.indexOf('panelKey="phone"')).toBeLessThan(otherToggle);
    expect(settings.indexOf('panelKey="language"')).toBeLessThan(otherToggle);
    expect(settings.indexOf('panelKey="auth"')).toBeGreaterThan(otherToggle);
    expect(settings).not.toMatch(/violet/i);
  });

  it("preserves phone, OTP and phone privacy boundaries unchanged", () => {
    const phone = read("app/settings/PhoneSettingsInline.tsx");
    const privacy = read("app/settings/PhonePrivacyControls.tsx");
    const history = read("app/settings/PhoneAccessHistory.tsx");

    expect(phone).toContain('fetch("/api/profile/phone"');
    expect(phone).toContain('fetch("/api/profile/phone/otp/send"');
    expect(phone).toContain('fetch("/api/profile/phone/otp/verify"');
    expect(phone).toContain('Authorization: "Bearer " + token');
    expect(privacy).toContain('fetch("/api/profile/phone/privacy"');
    expect(privacy).toContain('"private" | "transaction_participants"');
    expect(history).toContain('fetch("/api/profile/phone/access-history"');
  });

  it("preserves #698 secure password recovery, Turnstile and sessions", () => {
    const settings = read("app/settings/page.tsx");

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
    expect(settings).toContain("await supabase.auth.signOut()");
    expect(settings).toContain("supabase.auth.getUser()");
    expect(settings).not.toContain("password: newPassword");
    expect(settings).not.toContain("const [newPassword");
    expect(settings).not.toContain("const [confirmPassword");
    expect(settings).not.toMatch(
      /localStorage\.(?:setItem|getItem)\([^\n]*password/i
    );
  });

  it("keeps every secondary setting behind the single compact entry", () => {
    const settings = read("app/settings/page.tsx");
    const otherContent = settings.indexOf('data-testid="settings-other-content"');

    expect(otherContent).toBeGreaterThan(0);
    for (const token of [
      'panelKey="appearance"',
      'panelKey="auth"',
      'panelKey="notifications"',
      'panelKey="privacy"',
      'panelKey="delete"',
      'href="/provider/payments"',
      '{t("logout")}',
    ]) {
      expect(settings.indexOf(token)).toBeGreaterThan(otherContent);
    }
  });
});
