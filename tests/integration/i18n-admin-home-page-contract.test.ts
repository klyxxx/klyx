import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin home i18n contract", () => {
  it("localizes the admin home and keeps locale changes presentation-only", () => {
    const page = read("app/admin/page.tsx");

    expect(page).toContain("KLYX_ADMIN_HOME_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxAdminHome");
    expect(page).toContain("getKlyxAdminHomeAreaCopy");
    expect(page).not.toContain("Centre Admin KLYX");
    expect(page).not.toContain("Recherche globale disponible");
  });

  it("preserves the authenticated no-store access boundary", () => {
    const page = read("app/admin/page.tsx");

    expect(page).toContain("supabase.auth.getSession()");
    expect(page).toContain('fetch("/api/admin/access", {');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).toContain("let cancelled = false");
    expect(page).toContain("cancelled = true");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
  });

  it("preserves every admin and Founder destination", () => {
    const page = read("app/admin/page.tsx");

    for (const href of [
      "/founder",
      "/founder/test",
      "/founder/cleanup",
      "/admin/launch",
      "/admin/skills",
      "/admin/verifications",
      "/admin/disputes",
      "/admin/services",
      "/admin/finance",
    ]) {
      expect(page).toContain(`href: "${href}"`);
    }

    expect(page).toContain('href="/founder"');
    expect(page).toContain('href="/founder/test"');
    expect(page).toContain('href="/founder/cleanup"');
  });

  it("does not reflect backend or network error messages", () => {
    const page = read("app/admin/page.tsx");

    expect(page).not.toContain("body.error");
    expect(page).not.toContain("e.message");
    expect(page).not.toContain("error instanceof Error");
    expect(page).toContain('setErrorKey("sessionMissing")');
    expect(page).toContain('setErrorKey("accessDenied")');
    expect(page).toContain('setErrorKey("accessError")');
  });
});
