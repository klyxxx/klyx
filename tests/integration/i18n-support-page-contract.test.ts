import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX support page i18n contract", () => {
  it("keeps the support route as a server boundary with locale-aware metadata", () => {
    const page = read("app/support/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).toContain("KLYX_SUPPORT_PAGE_SERVER_BOUNDARY");
    expect(page).toContain('import { cookies } from "next/headers"');
    expect(page).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(page).toContain("normalizeKlyxLocale");
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain('translateKlyxSupportPage(locale, "metadataTitle")');
    expect(page).toContain(
      'translateKlyxSupportPage(locale, "metadataDescription")'
    );
    expect(page).toContain("<SupportPageContent />");
  });

  it("keeps support email and mailto construction configuration-driven", () => {
    const content = read("app/support/SupportPageContent.tsx");

    expect(content).toContain("KLYX_PUBLIC_CONFIG.supportEmail");
    expect(content).toContain("encodeURIComponent(");
    expect(content).toContain("supportHref(t(\"generalSubject\"), t(\"generalBody\"))");
    expect(content).toContain("supportHref(t(\"paymentSubject\"), t(\"paymentBody\"))");
    expect(content).toContain("supportHref(t(\"securitySubject\"), t(\"securityBody\"))");
    expect(content).toContain('href={`mailto:${email}`}');
  });

  it("preserves navigation and keeps the support presentation mutation-free", () => {
    const content = read("app/support/SupportPageContent.tsx");

    expect(content).toContain('href="/legal"');
    expect(content).toContain("<KlyxPublicFooter />");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("stripe");
  });

  it("moves the payment-card safety warning into every certified dictionary", () => {
    const content = read("app/support/SupportPageContent.tsx");
    const helper = read("lib/klyx-support-page-i18n.ts");

    expect(content).not.toContain(
      "Je n’envoie aucune donnée complète de carte bancaire."
    );
    expect(helper).toContain(
      "Je n’envoie aucune donnée complète de carte bancaire."
    );
    expect(helper).toContain("I am not sending any full payment card details.");
    expect(helper).toContain("Ik stuur geen volledige betaalkaartgegevens.");
    expect(helper).toContain("Ich sende keine vollständigen Zahlungskartendaten.");
  });
});
