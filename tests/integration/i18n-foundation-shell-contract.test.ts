import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

const i18n = read("lib/klyx-i18n.ts");
const provider = read("app/components/KlyxLocaleProvider.tsx");
const layout = read("app/layout.tsx");
const sidebar = read("app/ui/AppSidebar.tsx");
const settings = read("app/settings/page.tsx");
const documentation = read("docs/KLYX_I18N.md");

describe("KLYX i18n foundation shell contract", () => {
  it("ships a multilingual translated shell catalog with regional aliases", () => {
    for (const locale of [
      "fr",
      "en",
      "nl",
      "de",
      "es",
      "it",
      "pt",
      "ar",
      "zh-hans",
      "zh-hant",
      "ja",
      "ko",
    ]) {
      expect(i18n).toContain(`value: "${locale}"`);
    }

    expect(i18n).toContain('KLYX_DEFAULT_LOCALE: KlyxLocale =\n  "fr"');
    expect(i18n).toContain('normalized === "zh-tw"');
    expect(i18n).toContain('normalized === "zh-cn"');
  });

  it("reuses and persists the language preference and document direction", () => {
    expect(i18n).toContain('"klyx_language"');
    expect(provider).toContain("localStorage.getItem(");
    expect(provider).toContain("localStorage.setItem(");
    expect(provider).toContain("document.cookie");
    expect(provider).toContain("document.documentElement.lang = metadata.htmlLang");
    expect(provider).toContain("document.documentElement.dir = metadata.dir");
    expect(provider).toContain('window.addEventListener("storage", onStorage)');
  });

  it("wires locale context through the global application shell", () => {
    expect(layout).toContain("<KlyxLocaleProvider>");
    expect(layout).toContain("<KlyxSkipLink />");
    expect(sidebar).toContain("useKlyxLocale()");
    expect(sidebar).toContain("translateKlyxNavigationLabel(locale, item.title)");
    expect(sidebar).toContain('t("sidebar.searchPlaceholder")');
  });

  it("makes the settings selector use the canonical locale catalog immediately", () => {
    expect(settings).toContain("const { locale, setLocale } = useKlyxLocale();");
    expect(settings).toContain("value={locale}");
    expect(settings).toContain("onChange={setLocale}");
    expect(settings).toContain("KLYX_LANGUAGE_OPTIONS.map");
    expect(settings).not.toContain('const LANGUAGE_KEY = "klyx_language"');
  });

  it("keeps the rollout honest about incomplete page-level translation", () => {
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
    expect(documentation).toContain("metadata remain French");
    expect(documentation).toContain("Do not mark KLYX “fully internationalized”");
  });
});
