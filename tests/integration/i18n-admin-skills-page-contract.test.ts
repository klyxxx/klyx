import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin skills i18n contract", () => {
  it("localizes observer presentation without translating provider-authored content", () => {
    const page = read("app/admin/skills/page.tsx");

    expect(page).toContain("KLYX_ADMIN_SKILLS_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxAdminSkills");
    expect(page).toContain("translateKlyxAdminSkillStatus");
    expect(page).toContain("translateKlyxAdminSkillDocumentStatus");
    expect(page).not.toContain("Compétences prestataires");

    expect(page).toContain("row.serviceName");
    expect(page).toContain("row.providerName");
    expect(page).toContain("row.providerCity || t(\"cityMissing\")");
    expect(page).toContain("row.provider_statement");
    expect(page).toContain("row.review_note");
    expect(page).toContain("document.original_name");
    expect(page).toContain("document.proof_type");
  });

  it("preserves authenticated GET discovery and explicit document preview POST", () => {
    const page = read("app/admin/skills/page.tsx");

    expect(page).toContain('"/api/admin/skill-verifications"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${accessToken}`");
    expect(page).toContain('"/api/admin/skill-verifications/document"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("body: JSON.stringify({ documentId })");
    expect(page).toContain("onClick={() =>");
    expect(page).toContain("void preview(document.id)");
    expect(page).toContain('body.url,\n        "_blank",\n        "noopener,noreferrer"');
  });

  it("keeps the admin skills console observer-only", () => {
    const page = read("app/admin/skills/page.tsx");
    const route = read("app/api/admin/skill-verifications/route.ts");

    expect(route).toContain('mode: "external_verifier"');
    expect(route).toContain('provider: "sumsub_planned"');
    expect(route).toContain('adminRole: "observer"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain('"approve"');
    expect(page).not.toContain('"reject"');
  });

  it("preserves signed document URLs as a short-lived explicit view action", () => {
    const route = read("app/api/admin/skill-verifications/document/route.ts");

    expect(route).toContain('export async function POST(request: Request)');
    expect(route).toContain("documentId?: unknown");
    expect(route).toContain('.from("provider_skill_documents")');
    expect(route).toContain('.from("provider-verification")');
    expect(route).toContain(".createSignedUrl(data.storage_path, 60)");
    expect(route).toContain("expiresIn: 60");
  });

  it("does not reflect backend or network errors and keeps navigation explicit", () => {
    const page = read("app/admin/skills/page.tsx");

    expect(page).toContain('href="/admin"');
    expect(page).toContain("onClick={() => void load()}");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("e.message");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });
});
