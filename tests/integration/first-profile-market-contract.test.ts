import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX first-profile market contract", () => {
  it("requires an explicit canonical KLYX market before profile creation", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).toContain("KLYX_SUPPORTED_MARKETS");
    expect(source).toMatch(/countryCode[\s\S]*useState\(\s*["']["']\s*\)/);
    expect(source).toMatch(/if\s*\(\s*!countryCode\s*\)/);
    expect(source).toContain("KLYX_FIRST_PROFILE_MARKET_REQUIRED_16_01");
    expect(source).not.toMatch(/useState\(\s*["']BE["']\s*\)/);
  });

  it("sends the selected market to the existing server-side market boundary", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");
    const api = read("app/api/profiles/manage/route.ts");

    expect(source).toMatch(/JSON\.stringify\(\{[\s\S]*countryCode[\s\S]*accountType/);
    expect(api).toMatch(/readProfileMarket\(\s*body\.countryCode\s*\)/);
    expect(api).toContain("country_code: marketInput.countryCode");
    expect(api).toContain("currency_code: marketInput.currencyCode");
  });

  it("preserves the first-profile role lock, provider-only service and no-automatic-action boundary", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");
    const i18n = read("lib/klyx-first-profile-i18n.ts");

    expect(source).toContain("KLYX_FIRST_PROFILE_ROLE_LOCK_14_05");
    expect(source).toMatch(/roleChoiceUnlocked[\s\S]*useState\(\s*false\s*\)/);
    expect(source).toMatch(/if\s*\(\s*accountType\s*===\s*["']client["']\s*\)[\s\S]*setServiceId\(\s*["']["']\s*\)/);
    expect(source).toMatch(/serviceId\s*:\s*accountType\s*===\s*["']provider["']\s*\?\s*serviceId\s*:\s*null/);
    expect(source).toContain('t("noAutomaticAction")');
    expect(i18n).toContain("noAutomaticAction:");
    expect(i18n).toMatch(/noAutomaticAction:\s*["'][^"']*réservation[^"']*paiement[^"']*["']/);
  });
});
