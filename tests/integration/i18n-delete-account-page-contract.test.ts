import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX delete-account page i18n contract", () => {
  it("keeps the delete-account route as a server boundary with locale-aware metadata", () => {
    const page = read("app/delete-account/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_DELETE_ACCOUNT_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain(
      'translateKlyxDeleteAccountPage(locale, "metadataTitle")'
    );
    expect(page).toContain(
      'translateKlyxDeleteAccountPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<DeleteAccountPageContent />");
  });

  it("preserves the authenticated and web deletion-request paths", () => {
    const content = read("app/delete-account/DeleteAccountPageContent.tsx");

    expect(content).toContain('href="/legal"');
    expect(content).toContain('href="/settings"');
    expect(content).toContain("KLYX_PUBLIC_CONFIG.supportEmail");
    expect(content).toContain('encodeURIComponent(t("emailSubject"))');
    expect(content).toContain("encodeURIComponent(");
    expect(content).toContain('].join("\\n")');
    expect(content).toContain(
      'href={`mailto:${email}?subject=${subject}&body=${body}`}'
    );
    expect(content).toContain("<KlyxPublicFooter />");
  });

  it("keeps the public deletion presentation mutation-free", () => {
    const content = read("app/delete-account/DeleteAccountPageContent.tsx");

    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("moves identity-verification and retention boundaries into the certified dictionary", () => {
    const content = read("app/delete-account/DeleteAccountPageContent.tsx");
    const helper = read("lib/klyx-delete-account-page-i18n.ts");

    expect(content).not.toContain("vérification raisonnable");
    expect(helper).toContain(
      "KLYX peut demander une vérification raisonnable afin d’éviter qu’une autre personne supprime ton compte."
    );
    expect(helper).toContain(
      "KLYX may request reasonable verification to prevent another person from deleting your account."
    );
    expect(helper).toContain("supprimées ou anonymisées");
    expect(helper).toContain("deleted or anonymized");
    expect(helper).toContain(
      "vérification de mon identité peut être nécessaire avant traitement"
    );
    expect(helper).toContain(
      "verification of my identity may be necessary before processing"
    );
  });
});
