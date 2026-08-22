import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX first-profile page-i18n integration", () => {
  it("wires the client component to certified page translations and localized market names", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxFirstProfile");
    expect(source).toContain("translateKlyxFirstProfileApiError");
    expect(source).toContain("resolveKlyxFirstProfileLocale");
    expect(source).toContain("Intl.DisplayNames");
    expect(source).toContain("KLYX_SUPPORTED_MARKETS");
    expect(source).toContain("KLYX_FIRST_PROFILE_I18N_16_02");
  });

  it("preserves the explicit market, role lock and provider-only service boundaries", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).toMatch(/if\s*\(\s*!countryCode\s*\)/);
    expect(source).toMatch(/JSON\.stringify\(\{[\s\S]*countryCode[\s\S]*accountType/);
    expect(source).toContain("KLYX_FIRST_PROFILE_ROLE_LOCK_14_05");
    expect(source).toMatch(/roleChoiceUnlocked[\s\S]*useState\(\s*false\s*\)/);
    expect(source).toMatch(/serviceId\s*:\s*accountType\s*===\s*["']provider["']\s*\?\s*serviceId\s*:\s*null/);
    expect(source).toContain("router.refresh()");
  });

  it("does not surface unknown API messages directly", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).not.toMatch(/setErrorMessage\(\s*body\.error\s*\)/);
    expect(source).not.toMatch(/error\s+instanceof\s+Error\s*\?\s*error\.message/);
    expect(source).toContain("translateKlyxFirstProfileApiError(");
  });
});
