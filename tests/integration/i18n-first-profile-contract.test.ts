import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX first-profile page-i18n integration", () => {
  it("wires the client component to certified translations and global country/currency inputs", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxFirstProfile");
    expect(source).toContain("translateKlyxFirstProfileApiError");
    expect(source).toContain("KlyxMarketSelect");
    expect(source).toContain("currencyCode");
    expect(source).toContain('t("currencyRequired")');
    expect(source).not.toContain("KLYX_SUPPORTED_MARKETS");
    expect(source).toContain("KLYX_FIRST_PROFILE_I18N_16_02");
  });

  it("preserves the explicit market boundary while keeping role as transitional schema compatibility only", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).toMatch(/if\s*\(\s*!countryCode\s*\)/);
    expect(source).toMatch(/JSON\.stringify\(\{[\s\S]*countryCode[\s\S]*currencyCode[\s\S]*accountType/);
    expect(source).toContain('accountType: "client"');
    expect(source).toContain("serviceId: null");
    expect(source).toContain("Transitional schema value only");
    expect(source).not.toContain("setAccountType");
    expect(source).not.toContain("roleChoiceUnlocked");
    expect(source).toContain('router.replace("/assistant")');
    expect(source).toContain("router.refresh()");
  });

  it("does not surface unknown API messages directly", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).not.toMatch(/setErrorMessage\(\s*body\.error\s*\)/);
    expect(source).not.toMatch(/error\s+instanceof\s+Error\s*\?\s*error\.message/);
    expect(source).toContain("translateKlyxFirstProfileApiError(");
  });
});
