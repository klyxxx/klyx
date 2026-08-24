import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin services i18n contract", () => {
  it("localizes presentation while preserving provider-authored content", () => {
    const page = read("app/admin/services/page.tsx");
    expect(page).toContain("KLYX_ADMIN_SERVICES_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("proposal.proposed_name");
    expect(page).toContain("proposal.category");
    expect(page).toContain("proposal.description");
    expect(page).toContain("provider?.first_name");
    expect(page).toContain("provider?.last_name");
  });

  it("preserves GET no-store and explicit PATCH review only after confirmation", () => {
    const page = read("app/admin/services/page.tsx");
    expect(page).toContain('"/api/admin/service-proposals"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("window.confirm");
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain("proposalId: proposal.id");
    expect(page).toContain("action,");
    expect(page).toContain('adminNote: notes[proposal.id] ?? ""');
    expect(page).toContain('onClick={() => review(proposal, "approve")}');
    expect(page).toContain('onClick={() => review(proposal, "reject")}');
  });

  it("does not reflect raw backend errors or add automatic mutation", () => {
    const page = read("app/admin/services/page.tsx");
    expect(page).not.toContain("result.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("keeps server-side approval and rejection invariants untouched", () => {
    const route = read("app/api/admin/service-proposals/route.ts");
    expect(route).toContain('body.action === "approve" || body.action === "reject"');
    expect(route).toContain("body.adminNote.trim().slice(0, 500)");
    expect(route).toContain('action === "reject" && adminNote.length < 5');
    expect(route).toContain('proposal.status !== "pending"');
    expect(route).toContain('.from("services")');
    expect(route).toContain('.insert({ name: proposal.proposed_name, slug })');
  });
});
