import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX beta page i18n contract", () => {
  it("keeps the beta route as a server boundary with locale-aware metadata", () => {
    const page = read("app/beta/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_BETA_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain('translateKlyxBetaPage(locale, "metadataTitle")');
    expect(page).toContain(
      'translateKlyxBetaPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<BetaPageContent />");
  });

  it("delegates visible beta copy to the locale-aware client presentation", () => {
    const content = read("app/beta/BetaPageContent.tsx");

    expect(content).toContain('"use client"');
    expect(content).toContain("KLYX_BETA_PAGE_I18N");
    expect(content).toContain("useKlyxLocale()");
    expect(content).toContain("translateKlyxBetaPage(locale, key)");

    for (const key of [
      "heroTitle",
      "heroDescription",
      "clientTitle",
      "providerTitle",
      "verificationWarning",
      "installDescription",
    ]) {
      expect(content).toContain(`t("${key}")`);
    }
  });

  it("preserves all public beta destinations without introducing mutations", () => {
    const content = read("app/beta/BetaPageContent.tsx");

    expect(content).toContain('href="/"');
    expect(content).toContain('href="/login"');
    expect(content).toContain('href="/signup?type=client"');
    expect(content).toContain('href="/signup?type=provider"');
    expect(content).toContain('href="/install"');
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("moves the provider-verification honesty warning into the dictionary", () => {
    const content = read("app/beta/BetaPageContent.tsx");
    const helper = read("lib/klyx-beta-page-i18n.ts");

    expect(content).toContain('t("verificationWarning")');
    expect(content).not.toContain(
      "KLYX ne les présente pas comme validées tant qu’elles ne le sont pas réellement."
    );
    expect(helper).toContain(
      "KLYX ne les présente pas comme validées tant qu’elles ne le sont pas réellement."
    );
    expect(helper).toContain("does not present them as verified");
    expect(helper).toContain("niet als geverifieerd");
    expect(helper).toContain("erst dann als verifiziert");
  });
});
