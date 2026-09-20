import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX first-profile global market contract", () => {
  it("requires explicit country and transaction currency without a permanent country allow-list", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");

    expect(source).toContain("KlyxMarketSelect");
    expect(source).toMatch(/countryCode[\s\S]*useState\(\s*["']['"']\s*\)/);
    expect(source).toMatch(/currencyCode[\s\S]*useState\(\s*["']['"']\s*\)/);
    expect(source).toMatch(/if\s*\(\s*!countryCode\s*\)/);
    expect(source).toContain('t("currencyRequired")');
    expect(source).toContain("KLYX_FIRST_PROFILE_MARKET_REQUIRED_16_01");
    expect(source).not.toContain("KLYX_SUPPORTED_MARKETS");
    expect(source).not.toMatch(/useState\(\s*["']BE["']\s*\)/);
    expect(source).not.toMatch(/useState\(\s*["']EUR["']\s*\)/);
  });

  it("sends country and currency to the server-side profile boundary", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");
    const api = read("app/api/profiles/manage/route.ts");

    expect(source).toMatch(
      /JSON\.stringify\(\{[\s\S]*countryCode[\s\S]*currencyCode[\s\S]*accountType/
    );
    expect(api).toContain(
      "readProfileMarket(body.countryCode, body.currencyCode)"
    );
    expect(api).toContain("country_code: marketInput.countryCode");
    expect(api).toContain("currency_code: marketInput.currencyCode");
  });

  it("keeps first-profile creation roleless while preserving no-automatic-action safety", () => {
    const source = read("app/onboarding/FirstProfileSetup.tsx");
    const i18n = read("lib/klyx-first-profile-i18n.ts");

    expect(source).toContain('accountType: "client"');
    expect(source).toContain("serviceId: null");
    expect(source).toContain("Transitional schema value only");
    expect(source).not.toContain("roleChoiceUnlocked");
    expect(source).not.toContain("setAccountType");
    expect(source).toContain('t("noAutomaticAction")');
    expect(source).toContain('router.replace("/assistant")');
    expect(i18n).toContain("noAutomaticAction:");
    expect(i18n).toMatch(
      /noAutomaticAction:\s*["'][^"']*réservation[^"']*paiement[^"']*["']/
    );
  });
});
