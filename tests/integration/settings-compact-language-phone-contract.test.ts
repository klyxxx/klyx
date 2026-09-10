import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("KLYX compact settings language and phone contract", () => {
  it("renders the language control from the canonical certified catalog", () => {
    const settings = read("app/settings/page.tsx");
    const i18n = read("lib/klyx-i18n.ts");

    expect(settings).toContain("KLYX_SETTINGS_COMPACT_LANGUAGE_PHONE_20260910");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.find");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("value={selectedLanguage?.label ?? locale}");
    expect(settings).toContain('role="radiogroup"');
    expect(settings).toContain('role="radio"');
    expect(settings).toContain("onClick={() => setLocale(value)}");
    expect(settings).not.toContain('import KlyxSelect from "@/app/components/KlyxSelect"');

    expect(i18n).toContain("export const KLYX_FULLY_TRANSLATED_LOCALES");
    expect(i18n).toContain("export const KLYX_LANGUAGE_OPTIONS = KLYX_REGISTERED_LANGUAGE_OPTIONS.filter(");
    expect(i18n).toContain("FULLY_TRANSLATED_LOCALE_SET.has(option.value)");
  });

  it("keeps the compact settings surface blue-only", () => {
    const sources = [
      "app/settings/page.tsx",
      "app/settings/PhoneSettingsInline.tsx",
      "app/settings/PhonePrivacyControls.tsx",
    ].map(read);

    for (const source of sources) {
      expect(source).not.toMatch(/violet|purple|fuchsia/i);
    }
  });

  it("compacts phone UI without changing the phone or OTP boundaries", () => {
    const source = read("app/settings/PhoneSettingsInline.tsx");

    expect(source).toContain("KLYX_PHONE_SETTINGS_COMPACT_20260910");
    expect(source).toContain('fetch("/api/profile/phone"');
    expect(source).toContain('method: "PUT"');
    expect(source).toContain('fetch("/api/profile/phone/otp/send"');
    expect(source).toContain('fetch("/api/profile/phone/otp/verify"');
    expect(source).toMatch(/JSON\.stringify\(\{\s*phoneNumber\s*\}\)/);
    expect(source).toMatch(/JSON\.stringify\(\{\s*code:\s*cleanCode\s*\}\)/);
    expect(source).toMatch(/phoneNumber\s*!==\s*savedPhone/);
    expect(source).toContain("setCooldown(result.retryAfter ?? 60)");
    expect(source).not.toContain("min-h-28");
    expect(source).not.toContain("p-6 sm:p-7");
  });

  it("compacts phone privacy without changing visibility semantics or authorization", () => {
    const source = read("app/settings/PhonePrivacyControls.tsx");

    expect(source).toContain("KLYX_PHONE_PRIVACY_COMPACT_20260910");
    expect(source).toContain('type Visibility = "private" | "transaction_participants"');
    expect(source).toContain('fetch("/api/profile/phone/privacy"');
    expect(source).toContain('method: "PUT"');
    expect(source).toContain('Authorization: "Bearer " + token');
    expect(source).toContain("JSON.stringify({ visibility: nextVisibility })");
    expect(source).toContain('changeVisibility("transaction_participants")');
    expect(source).toContain('changeVisibility("private")');
    expect(source).not.toContain("min-h-28");
  });

  it("preserves the secure password recovery flow merged in #698", () => {
    const source = read("app/settings/page.tsx");

    expect(source).toContain("KLYX_SETTINGS_PASSWORD_RECOVERY_20260909");
    expect(source).toContain("AUTH_TURNSTILE_ENABLED");
    expect(source).toContain('action="password-reset"');
    expect(source).toContain("supabase.auth.resetPasswordForEmail(");
    expect(source).toContain('redirectTo: `${window.location.origin}/reset-password`');
    expect(source).toContain("captchaToken: AUTH_TURNSTILE_ENABLED");
    expect(source).not.toContain("password: newPassword");
  });
});
