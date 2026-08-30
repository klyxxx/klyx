import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const publicActions = read("app/components/PublicSessionActions.tsx");
const pageI18n = read("lib/klyx-page-i18n.ts");

describe("KLYX public entry page-i18n integration", () => {
  it("wires public entry actions to the active KLYX locale", () => {
    expect(publicActions).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(publicActions).toContain('from "@/lib/klyx-page-i18n"');
    expect(publicActions).toContain("const { locale } = useKlyxLocale()");
    expect(publicActions).toContain("translateKlyxPublicEntry(locale, key)");
  });

  it("keeps page coverage separate from the 64-locale shell catalog", () => {
    expect(pageI18n).toContain(
      'KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"]'
    );
    expect(pageI18n).toContain(': "fr"');
    expect(pageI18n).toContain("hasKlyxPublicPageTranslation");
  });

  it("preserves public-entry behavior without internal evolution markers", () => {
    expect(publicActions).toContain("createClient()");
    expect(publicActions).toContain("supabase.auth.getUser()");
    expect(publicActions).toContain('href="/dashboard"');
    expect(publicActions).toContain('href="/accounts"');
    expect(publicActions).toContain('href="/login"');
    expect(publicActions).toContain('href="/signup?type=client"');
    expect(publicActions).toContain('href="/signup?type=provider"');
    expect(publicActions).not.toMatch(/KLYX_[A-Z0-9_]*\d+_\d+/);
  });
});
