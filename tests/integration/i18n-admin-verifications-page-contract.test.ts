import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin verifications i18n contract", () => {
  it("localizes presentation while preserving private document names", () => {
    const page = read("app/admin/verifications/page.tsx");
    expect(page).toContain("KLYX_ADMIN_VERIFICATIONS_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("document.original_name");
    expect(page).toContain("row.precheck.score");
    expect(page).toContain("getKlyxAdminVerificationPrecheckText");
  });

  it("preserves GET loading and document POST only on document click", () => {
    const page = read("app/admin/verifications/page.tsx");
    expect(page).toContain('fetch("/api/admin/verifications", {');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain('"/api/admin/verifications/document"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("body: JSON.stringify({ documentId })");
    expect(page).toContain("onClick={() => void openDocument(document.id)}");
    expect(page).toContain('window.open(body.url, "_blank", "noopener,noreferrer")');
  });

  it("preserves explicit decision POST payload and action values", () => {
    const page = read("app/admin/verifications/page.tsx");
    for (const action of ["under_review", "approved", "changes_required", "rejected", "reopened"]) {
      expect(page).toContain(`"${action}"`);
    }
    expect(page).toContain("verificationId,");
    expect(page).toContain("action,");
    expect(page).toContain('note: notes[verificationId] ?? ""');
    expect(page).toContain("onClick={() => void decide(row.id, action)}");
    expect(page).toContain("await load()");
  });

  it("does not reflect backend errors or add automatic mutation", () => {
    const page = read("app/admin/verifications/page.tsx");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("body.message");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("keeps server decision constraints and signed URL lifetime untouched", () => {
    const route = read("app/api/admin/verifications/route.ts");
    const documentRoute = read("app/api/admin/verifications/document/route.ts");
    expect(route).toContain('"under_review"');
    expect(route).toContain('"approved"');
    expect(route).toContain('"changes_required"');
    expect(route).toContain('"rejected"');
    expect(route).toContain('"reopened"');
    expect(route).toContain("note.trim().slice(0, 1000)");
    expect(route).toContain('["changes_required", "rejected"].includes(action)');
    expect(route).toContain("note.length < 10");
    expect(route).toContain('selectedAction === "approved" &&');
    expect(route).toContain("!precheck.passed");
    expect(documentRoute).toContain("createSignedUrl(document.storage_path, 60)");
  });
});
