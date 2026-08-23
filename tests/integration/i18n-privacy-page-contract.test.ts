import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX privacy page i18n contract", () => {
  it("keeps the privacy route as a server boundary with locale-aware metadata", () => {
    const page = read("app/privacy/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_PRIVACY_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain('translateKlyxPrivacyPage(locale, "metadataTitle")');
    expect(page).toContain(
      'translateKlyxPrivacyPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<PrivacyPageContent />");
  });

  it("preserves public legal identity, contact and deletion navigation", () => {
    const content = read("app/privacy/PrivacyPageContent.tsx");

    expect(content).toContain('href="/legal"');
    expect(content).toContain('href="/delete-account"');
    expect(content).toContain("KLYX_PUBLIC_CONFIG");
    expect(content).toContain("config.legalName");
    expect(content).toContain("config.legalAddress &&");
    expect(content).toContain("config.companyNumber &&");
    expect(content).toContain("config.supportEmail");
    expect(content).toContain('href={`mailto:${config.supportEmail}`}');
    expect(content).toContain("<KlyxPublicFooter />");
  });

  it("keeps the privacy presentation mutation-free", () => {
    const content = read("app/privacy/PrivacyPageContent.tsx");

    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("moves card-data, retention and identity-verification boundaries into the dictionary", () => {
    const content = read("app/privacy/PrivacyPageContent.tsx");
    const helper = read("lib/klyx-privacy-page-i18n.ts");

    expect(content).not.toContain(
      "Les données de carte sont traitées par le prestataire de paiement"
    );
    expect(helper).toContain(
      "Les données de carte sont traitées par le prestataire de paiement et ne sont pas destinées à être stockées directement par KLYX."
    );
    expect(helper).toContain(
      "Card data is processed by the payment provider and is not intended to be stored directly by KLYX."
    );
    expect(helper).toContain("supprimées ou anonymisées");
    expect(helper).toContain("deleted or anonymized");
    expect(helper).toContain(
      "Une vérification d’identité peut être demandée avant de traiter une demande externe"
    );
    expect(helper).toContain(
      "Identity verification may be requested before processing an external request"
    );
  });

  it("keeps the published privacy date on August 10, 2026 in every locale", () => {
    const helper = read("lib/klyx-privacy-page-i18n.ts");

    expect(helper).toContain("10 août 2026");
    expect(helper).toContain("August 10, 2026");
    expect(helper).toContain("10 augustus 2026");
    expect(helper).toContain("10. August 2026");
  });
});
