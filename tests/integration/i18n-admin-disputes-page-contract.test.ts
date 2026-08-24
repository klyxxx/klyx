import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin disputes i18n contract", () => {
  it("localizes the admin disputes presentation", () => {
    const page = read("app/admin/disputes/page.tsx");

    expect(page).toContain("KLYX_ADMIN_DISPUTES_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxAdminDisputes");
    expect(page).toContain("translateKlyxTrustReason");
    expect(page).toContain("translateKlyxTrustStatus");
    expect(page).not.toContain("Administration des litiges");
    expect(page).not.toContain("Enregistrer la décision");
  });

  it("preserves authenticated no-store GET and explicit POST only on save", () => {
    const page = read("app/admin/disputes/page.tsx");

    expect(page).toContain('fetch("/api/admin/disputes", {');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("onClick={() => void save(row.id)}");
    expect(page).toContain("disputeId,");
    expect(page).toContain("status: form.status");
    expect(page).toContain("decisionCode: form.decisionCode");
    expect(page).toContain("note: form.note");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("does not reflect backend errors or success messages", () => {
    const page = read("app/admin/disputes/page.tsx");

    expect(page).not.toContain("body.error");
    expect(page).not.toContain("body.message");
    expect(page).not.toContain("error.message");
    expect(page).toContain('setErrorMessage(t("loadError"))');
    expect(page).toContain('setErrorMessage(t("updateError"))');
    expect(page).toContain('setSuccessMessage(t("updateSuccess"))');
  });

  it("keeps user-authored dispute descriptions and admin notes verbatim", () => {
    const page = read("app/admin/disputes/page.tsx");

    expect(page).toContain("row.description");
    expect(page).toContain("note: dispute.decision_note ?? \"\"");
    expect(page).toContain("value={form.note}");
    expect(page).toContain("maxLength={2000}");
  });

  it("does not add automatic financial or booking behavior", () => {
    const page = read("app/admin/disputes/page.tsx");

    expect(page).not.toContain("PaymentIntent");
    expect(page).not.toContain("checkout");
    expect(page).not.toContain("refund(");
    expect(page).not.toContain("supabase");
  });

  it("leaves the server dispute mutation contract untouched", () => {
    const route = read("app/api/admin/disputes/route.ts");

    expect(route).toContain("export async function GET()");
    expect(route).toContain("export async function POST(request: Request)");
    expect(route).toContain("disputeId?: unknown");
    expect(route).toContain("status?: unknown");
    expect(route).toContain("decisionCode?: unknown");
    expect(route).toContain("note?: unknown");
    expect(route).toContain('.from("disputes")');
    expect(route).toContain(".update(updatePayload)");
    expect(route).toContain('.from("dispute_events")');
    expect(route).toContain('.from("user_notifications")');
  });
});
