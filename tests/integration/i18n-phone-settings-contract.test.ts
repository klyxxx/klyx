import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("KLYX phone settings i18n contract", () => {
  it("localizes the phone UI without reflecting arbitrary server errors", () => {
    const source = read("app/settings/PhoneSettingsInline.tsx");

    expect(source).toContain("KLYX_PHONE_SETTINGS_I18N_16_06");
    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxPhoneSettings");
    expect(source).toContain("resolveKlyxPhoneSettingsPublicErrorKey");
    expect(source).not.toMatch(/setErrorMessage\s*\(/);
    expect(source).not.toMatch(/result\.error\s*\|\|/);
  });

  it("preserves the existing phone and OTP network boundaries", () => {
    const source = read("app/settings/PhoneSettingsInline.tsx");

    expect(source).toContain('fetch("/api/profile/phone"');
    expect(source).toContain('method: "PUT"');
    expect(source).toContain('fetch("/api/profile/phone/otp/send"');
    expect(source).toContain('fetch("/api/profile/phone/otp/verify"');
    expect(source).toMatch(/JSON\.stringify\(\{\s*phoneNumber\s*\}\)/);
    expect(source).toMatch(/JSON\.stringify\(\{\s*code:\s*cleanCode\s*\}\)/);
    expect(source).toMatch(/phoneNumber\s*!==\s*savedPhone/);
    expect(source).toMatch(/replace\(\/\\D\/g,\s*""\)/);
    expect(source).toContain('.slice(0, 10)');
  });

  it("keeps OTP rate-limit and lock semantics server-side and unchanged", () => {
    const send = read("app/api/profile/phone/otp/send/otp-send-route-core.ts");
    const verify = read("app/api/profile/phone/otp/verify/otp-verify-route-core.ts");

    expect(send).toContain("const SEND_COOLDOWN_SECONDS = 60;");
    expect(verify).toContain("const MAX_FAILED_ATTEMPTS = 5;");
    expect(verify).toContain("const LOCK_MINUTES = 15;");
    expect(verify).toContain('/^\\d{4,10}$/.test(code)');
    expect(verify).toMatch(/\.eq\("phone_number",\s*phoneNumber\)/);
    expect(verify).toMatch(/failedAttempts\s*>=\s*MAX_FAILED_ATTEMPTS/);
  });

  it("keeps unexpected OTP 5xx responses behind secure API wrappers", () => {
    const sendWrapper = read("app/api/profile/phone/otp/send/route.ts");
    const verifyWrapper = read("app/api/profile/phone/otp/verify/route.ts");

    expect(sendWrapper).toContain("secureApiErrorResponse");
    expect(verifyWrapper).toContain("secureApiErrorResponse");
    expect(sendWrapper).toMatch(/response\.status\s*<\s*500/);
    expect(verifyWrapper).toMatch(/response\.status\s*<\s*500/);
  });
});
