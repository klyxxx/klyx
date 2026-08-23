import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX legal page i18n contract", () => {
  it("keeps the legal route as a server boundary with locale-aware metadata", () => {
    const page = read("app/legal/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_LEGAL_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain('translateKlyxLegalPage(locale, "metadataTitle")');
    expect(page).toContain(
      'translateKlyxLegalPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<LegalPageContent />");
  });

  it("delegates visible copy to the locale-aware client presentation", () => {
    const content = read("app/legal/LegalPageContent.tsx");

    expect(content).toContain('"use client"');
    expect(content).toContain("KLYX_LEGAL_PAGE_I18N");
    expect(content).toContain("useKlyxLocale()");
    expect(content).toContain("translateKlyxLegalPage(locale, key)");
    expect(content).toContain("<KlyxPublicFooter />");
  });

  it("preserves every legal destination without introducing mutations", () => {
    const content = read("app/legal/LegalPageContent.tsx");

    expect(content).toContain('href="/"');
    expect(content).toContain('href: "/privacy"');
    expect(content).toContain('href: "/terms"');
    expect(content).toContain('href: "/support"');
    expect(content).toContain('href: "/delete-account"');
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });
});
