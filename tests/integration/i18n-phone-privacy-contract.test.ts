import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("KLYX phone privacy i18n contract", () => {
  it("localizes presentation without reflecting arbitrary server errors", () => {
    const source = read("app/settings/PhonePrivacyControls.tsx");

    expect(source).toContain("KLYX_PHONE_PRIVACY_I18N_16_07");
    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxPhonePrivacy");
    expect(source).toContain("resolveKlyxPhonePrivacyPublicErrorKey");
    expect(source).not.toMatch(/setErrorMessage\s*\(/);
    expect(source).not.toMatch(/result\.error\s*\|\|/);
  });

  it("keeps the existing privacy GET/PUT boundary and exact values", () => {
    const source = read("app/settings/PhonePrivacyControls.tsx");

    expect(source).toContain('fetch("/api/profile/phone/privacy"');
    expect(source).toContain('method: "PUT"');
    expect(source).toContain('"private" | "transaction_participants"');
    expect(source).toContain('useState<Visibility>("transaction_participants")');
    expect(source).toMatch(/JSON\.stringify\(\{\s*visibility:\s*nextVisibility\s*\}\)/);
    expect(source).toMatch(/if\s*\(nextVisibility\s*===\s*visibility\)\s*return/);
  });

  it("keeps server validation and default visibility unchanged", () => {
    const core = read(
      "app/api/profile/phone/privacy/phone-privacy-route-core.ts"
    );

    expect(core).toContain('value === "private"');
    expect(core).toContain('"transaction_participants"');
    expect(core).toContain('body.visibility !== "private"');
    expect(core).toContain('body.visibility !==\n        "transaction_participants"');
    expect(core).toContain('phone_visibility:\n            body.visibility');
  });

  it("keeps unexpected privacy 5xx responses behind the secure wrapper", () => {
    const wrapper = read("app/api/profile/phone/privacy/route.ts");

    expect(wrapper).toContain("secureApiErrorResponse");
    expect(wrapper).toMatch(/response\.status\s*<\s*500/);
  });
});
