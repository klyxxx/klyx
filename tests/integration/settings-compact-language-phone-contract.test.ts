import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("KLYX compact language and phone settings contract", () => {
  it("uses only the canonical selectable language catalog in a compact blue picker", () => {
    const settings = read("app/settings/page.tsx");

    expect(settings).toContain("KLYX_SETTINGS_COMPACT_LANGUAGE_PHONE_20260910");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.find");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).toContain('role="radiogroup"');
    expect(settings).toContain('role="radio"');
    expect(settings).not.toContain("KlyxSelect");
    expect(settings).not.toContain("KLYX_REGISTERED_LANGUAGE_OPTIONS");
    expect(settings).not.toMatch(/violet/i);
  });

  it("keeps phone save and OTP authorization boundaries while compacting presentation", () => {
    const phone = read("app/settings/PhoneSettingsInline.tsx");

    expect(phone).toContain("KLYX_PHONE_COMPACT_UI_20260910");
    expect(phone).toContain('fetch("/api/profile/phone"');
    expect(phone).toContain('method: "PUT"');
    expect(phone).toContain('fetch("/api/profile/phone/otp/send"');
    expect(phone).toContain('fetch("/api/profile/phone/otp/verify"');
    expect(phone).toContain('Authorization: "Bearer " + token');
    expect(phone).toMatch(/JSON\.stringify\(\{\s*phoneNumber\s*\}\)/);
    expect(phone).toMatch(/JSON\.stringify\(\{\s*code:\s*cleanCode\s*\}\)/);
    expect(phone).toContain('className="mb-0 rounded-xl');
    expect(phone).not.toMatch(/violet/i);
  });

  it("keeps phone privacy semantics exact while rendering a shorter control", () => {
    const privacy = read("app/settings/PhonePrivacyControls.tsx");

    expect(privacy).toContain("KLYX_PHONE_PRIVACY_COMPACT_UI_20260910");
    expect(privacy).toContain('fetch("/api/profile/phone/privacy"');
    expect(privacy).toContain('method: "PUT"');
    expect(privacy).toContain('"private" | "transaction_participants"');
    expect(privacy).toMatch(/JSON\.stringify\(\{\s*visibility:\s*nextVisibility\s*\}\)/);
    expect(privacy).toContain("min-h-0");
    expect(privacy).not.toContain("min-h-28");
    expect(privacy).not.toMatch(/violet/i);
  });

  it("preserves the secure password recovery merged in #698", () => {
    const settings = read("app/settings/page.tsx");

    expect(settings).toContain("KLYX_SETTINGS_PASSWORD_RECOVERY_20260909");
    expect(settings).toContain("supabase.auth.resetPasswordForEmail(");
    expect(settings).toContain('action="password-reset"');
    expect(settings).toContain("AUTH_TURNSTILE_ENABLED");
    expect(settings).not.toContain("password: newPassword");
    expect(settings).not.toContain("const [newPassword");
    expect(settings).not.toContain("const [confirmPassword");
  });
});
