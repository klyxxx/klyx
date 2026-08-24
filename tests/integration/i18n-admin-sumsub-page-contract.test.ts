import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin Sumsub i18n contract", () => {
  it("localizes the read-only presentation", () => {
    const page = read("app/admin/sumsub/page.tsx");

    expect(page).toContain("KLYX_ADMIN_SUMSUB_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxAdminSumsub");
    expect(page).toContain("translateKlyxAdminSumsubAnswer");
    expect(page).toContain("translateKlyxAdminSumsubKlyxStatus");
    expect(page).toContain("translateKlyxAdminSumsubRejectType");
    expect(page).not.toContain("Décisions Sumsub");
    expect(page).not.toContain("Lecture seule");
  });

  it("preserves authenticated no-store GET-only access", () => {
    const page = read("app/admin/sumsub/page.tsx");
    const route = read("app/api/admin/sumsub/route.ts");

    expect(page).toContain("supabase.auth.getSession()");
    expect(page).toContain('"/api/admin/sumsub"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization:");
    expect(page).toContain("`Bearer ${session.access_token}`");
    expect(page).toContain("onClick={() => void load()}");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");

    expect(route).toContain("export async function GET()");
    expect(route).toContain('.from("provider_verifications")');
    expect(route).toContain('"external_provider",');
    expect(route).toContain('"sumsub"');
  });

  it("keeps external and provider-authored evidence verbatim", () => {
    const page = read("app/admin/sumsub/page.tsx");

    expect(page).toContain("row.external_applicant_id");
    expect(page).toContain("row.external_moderation_comment");
    expect(page).toContain("row.providerName");
    expect(page).toContain("displayKlyxAdminSumsubProviderName");
  });

  it("does not reflect raw backend errors or unknown enums", () => {
    const page = read("app/admin/sumsub/page.tsx");

    expect(page).not.toContain("body.error");
    expect(page).not.toContain("e.message");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
    expect(page).not.toContain("?? row.status");
    expect(page).not.toContain("?? row.external_review_status");
    expect(page).not.toContain("?? row.external_reject_type");
  });

  it("preserves explicit admin navigation and has no automatic retry", () => {
    const page = read("app/admin/sumsub/page.tsx");

    expect(page).toContain('href="/admin"');
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });
});
