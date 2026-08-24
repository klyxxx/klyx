import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX trust overview i18n contract", () => {
  it("uses the shared KLYX locale provider and dedicated trust dictionary", () => {
    const page = read("app/trust/page.tsx");

    expect(page).toContain("KLYX_TRUST_OVERVIEW_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(page).toContain("translateKlyxTrust");
    expect(page).toContain("translateKlyxTrustReason");
    expect(page).toContain("translateKlyxTrustStatus");
    expect(page).not.toContain("Centre de confiance client");
    expect(page).not.toContain("Prestataire absent");
  });

  it("preserves disputes as an authenticated no-store GET-only read", () => {
    const page = read("app/trust/page.tsx");

    expect(page).toContain("supabase.auth.getSession()");
    expect(page).toContain('fetch("/api/disputes"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization:");
    expect(page).toContain("Bearer ${session.access_token}");
    expect(page).not.toContain("method:");
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("preserves explicit report and booking navigation without creating disputes", () => {
    const page = read("app/trust/page.tsx");

    expect(page).toContain('href="/trust/new"');
    expect(page).toContain("href={`/bookings/${dispute.booking_id}`}");
    expect(page).toContain("{dispute.description}");
    expect(page).not.toContain("router.push");
  });

  it("does not reflect backend errors or unknown backend enum identifiers", () => {
    const page = read("app/trust/page.tsx");
    const helper = read("lib/klyx-trust-page-i18n.ts");

    expect(page).not.toContain("result.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("REASON_LABELS");
    expect(page).not.toContain("STATUS_LABELS");
    expect(helper).toContain("unknownReason");
    expect(helper).toContain("unknownStatus");
  });

  it("keeps the existing server-side client-only authorization boundary untouched", () => {
    const layout = read("app/trust/layout.tsx");

    expect(layout).toContain("supabase.auth.getUser()");
    expect(layout).toContain("getActiveProfile()");
    expect(layout).toContain('redirect("/login")');
    expect(layout).toContain('redirect("/profile")');
    expect(layout).toContain('profile.accountType !== "client"');
    expect(layout).toContain('redirect("/provider/trust")');
  });
});
