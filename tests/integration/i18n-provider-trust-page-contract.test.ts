import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) { return fs.readFileSync(path.join(process.cwd(), relative), "utf8"); }

describe("KLYX provider trust i18n contract", () => {
  it("uses shared locale and trust dictionaries", () => {
    const page = read("app/provider/trust/page.tsx");
    expect(page).toContain("KLYX_PROVIDER_TRUST_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxProviderTrust");
    expect(page).toContain("translateKlyxTrustReason");
    expect(page).toContain("translateKlyxTrustStatus");
    expect(page).toContain("getKlyxTrustIntlLocale");
    expect(page).not.toContain("Centre de confiance prestataire");
  });

  it("preserves authenticated no-store GET-only behavior on the active provider profile", () => {
    const page = read("app/provider/trust/page.tsx");
    expect(page).toContain("getActiveProfileAccount()");
    expect(page).toContain('profile.accountType !== "provider"');
    expect(page).toContain("supabase.auth.getSession()");
    expect(page).toContain('fetch("/api/disputes"');
    expect(page).toContain('cache: "no-store"');
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("preserves exact received and opened filters", () => {
    const page = read("app/provider/trust/page.tsx");
    expect(page).toContain("dispute.against_profile_id === profileId");
    expect(page).toContain("dispute.opened_by === profileId");
  });

  it("keeps user-authored descriptions verbatim and hides raw backend/enums", () => {
    const page = read("app/provider/trust/page.tsx");
    expect(page).toContain("{dispute.description}");
    expect(page).not.toContain("result.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("?? dispute.reason");
    expect(page).not.toContain("?? dispute.status");
  });

  it("keeps provider trust free of the client-only report route and preserves booking navigation", () => {
    const page = read("app/provider/trust/page.tsx");
    expect(page).not.toContain('href="/trust/new"');
    expect(page).not.toContain('t("reportClient")');
    expect(page).toContain('href={`/bookings/${dispute.booking_id}`}');
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });
});
