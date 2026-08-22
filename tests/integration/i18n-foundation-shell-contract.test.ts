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
  it("supports the existing French English Dutch language choices", () => {
    expect(i18n).toContain('"fr"');
    expect(i18n).toContain('"en"');
    expect(i18n).toContain('"nl"');
    expect(i18n).toContain('KLYX_DEFAULT_LOCALE: KlyxLocale =\n  "fr"');
  });

  it("reuses and persists the existing language preference", () => {
    expect(i18n).toContain('"klyx_language"');
    expect(provider).toContain("localStorage.getItem(");
    expect(provider).toContain("localStorage.setItem(");
    expect(provider).toContain("document.cookie");
    expect(provider).toContain("document.documentElement.lang = locale");
    expect(provider).toContain('window.addEventListener("storage", onStorage)');
  });

  it("wires locale context through the global application shell", () => {
    expect(layout).toContain("<KlyxLocaleProvider>");
    expect(layout).toContain("<KlyxSkipLink />");
    expect(sidebar).toContain("useKlyxLocale()");
    expect(sidebar).toContain("translateKlyxNavigationLabel(locale, item.title)");
    expect(sidebar).toContain('t("sidebar.searchPlaceholder")');
  });

  it("makes the existing settings selector apply locale immediately", () => {
    expect(settings).toContain("const { setLocale } = useKlyxLocale();");
    expect(settings).toContain("setLocale(value);");
    expect(settings).toContain('{ value: "fr", label: "Français" }');
    expect(settings).toContain('{ value: "en", label: "English" }');
    expect(settings).toContain('{ value: "nl", label: "Nederlands" }');
  });

  it("keeps the rollout honest about incomplete page-level translation", () => {
    expect(documentation).toContain("not** full-site internationalization");
    expect(documentation).toContain("Most page-level copy");
    expect(documentation).toContain("metadata remain French");
    expect(documentation).toContain("Do not mark KLYX “fully internationalized”");
  });
});
