import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX terms page i18n contract", () => {
  it("keeps the terms route as a server boundary with locale-aware metadata", () => {
    const page = read("app/terms/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_TERMS_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain('translateKlyxTermsPage(locale, "metadataTitle")');
    expect(page).toContain(
      'translateKlyxTermsPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<TermsPageContent />");
  });

  it("preserves legal navigation and configuration-driven contact", () => {
    const content = read("app/terms/TermsPageContent.tsx");

    expect(content).toContain('href="/legal"');
    expect(content).toContain('href="/privacy"');
    expect(content).toContain("KLYX_PUBLIC_CONFIG");
    expect(content).toContain("config.supportEmail");
    expect(content).toContain('href={`mailto:${config.supportEmail}`}');
    expect(content).toContain("<KlyxPublicFooter />");
  });

  it("keeps the terms presentation mutation-free", () => {
    const content = read("app/terms/TermsPageContent.tsx");

    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("moves the payment, refund and trust boundaries into the certified dictionary", () => {
    const content = read("app/terms/TermsPageContent.tsx");
    const helper = read("lib/klyx-terms-page-i18n.ts");

    expect(content).not.toContain(
      "Une réservation ne doit pas être considérée comme payée"
    );
    expect(helper).toContain(
      "Une réservation ne doit pas être considérée comme payée tant que KLYX n’a pas reçu la confirmation correspondante."
    );
    expect(helper).toContain(
      "A booking must not be considered paid until KLYX has received the corresponding confirmation."
    );
    expect(helper).toContain("procédure de litige plutôt qu’une annulation automatique");
    expect(helper).toContain("dispute procedure rather than automatic cancellation");
    expect(helper).toContain("garantie absolue");
    expect(helper).toContain("absolute guarantee");
  });

  it("keeps the published legal date on August 10, 2026 in every locale", () => {
    const helper = read("lib/klyx-terms-page-i18n.ts");

    expect(helper).toContain("10 août 2026");
    expect(helper).toContain("August 10, 2026");
    expect(helper).toContain("10 augustus 2026");
    expect(helper).toContain("10. August 2026");
  });
});
