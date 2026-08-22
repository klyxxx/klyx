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

  it("preserves the existing public-entry source contracts", () => {
    expect(publicActions).toContain("KLYX_CONNECTED_ENTRY_14_01");
    expect(publicActions).toContain("KLYX_PUBLIC_COMPACT_ENTRY_14_01");
    expect(publicActions).toContain("KLYX_DUAL_PUBLIC_ENTRY_14_01");
    expect(publicActions).toContain("KLYX_EXISTING_ACCOUNT_ENTRY_14_01");
  });
});
