import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX SSR locale shell contract", () => {
  it("resolves the server locale from the persisted cookie then Accept-Language", () => {
    const source = read("lib/klyx-server-i18n.ts");

    expect(source).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(source).toContain('requestHeaders.get("accept-language")');
    expect(source).toContain("resolveKlyxLocale(browserLanguages)");
    expect(source).toContain("if (quality <= 0)");
    expect(source).toContain('import "server-only"');
  });

  it("renders html lang and direction from the server locale", () => {
    const source = read("app/layout.tsx");

    expect(source).toContain("await getServerKlyxLocale()");
    expect(source).toContain("lang={localeMetadata.htmlLang}");
    expect(source).toContain("dir={localeMetadata.dir}");
    expect(source).toContain("data-klyx-locale={locale}");
    expect(source).toContain("initialLocale={locale}");
    expect(source).not.toContain('lang="fr"');
  });

  it("generates locale-aware root metadata without claiming every locale is translated", () => {
    const source = read("app/layout.tsx");

    expect(source).toContain("export async function generateMetadata");
    expect(source).toContain("SEO_COPY[locale] ?? SEO_COPY.en!");
    expect(source).toContain('title: "KLYX — Dagelijkse diensten, eenvoudig"');
    expect(source).toContain('title: "KLYX — Alltagsservices, einfach"');
  });

  it("hydrates the client locale from the same server-selected locale", () => {
    const source = read("app/components/KlyxLocaleProvider.tsx");

    expect(source).toContain("initialLocale?: KlyxLocale");
    expect(source).toContain("normalizeKlyxLocale(initialLocale)");
    expect(source).not.toContain("navigator.languages");
  });

  it("keeps the universal service selector locale-aware", () => {
    const source = read("app/components/KlyxServiceSelect.tsx");

    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("COPY.en");
    expect(source).toContain('placeholder: "Kies een dienst"');
    expect(source).toContain('placeholder: "Dienstleistung auswählen"');
    expect(source).not.toContain('toLocaleLowerCase("fr")');
  });
});
