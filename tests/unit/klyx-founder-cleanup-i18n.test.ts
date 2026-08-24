import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder cleanup i18n contract", () => {
  it("preserves read-only audit loading", () => {
    const page = read("app/founder/cleanup/page.tsx");
    expect(page).toContain('fetch("/api/founder/accounts-audit", {');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("void load();");
    expect(page).toContain("onClick={() => void load()}");
  });

  it("preserves the exact explicit destructive action and payload", () => {
    const page = read("app/founder/cleanup/page.tsx");
    expect(page).toContain('fetch("/api/founder/accounts-cleanup", {');
    expect(page).toContain('method: "DELETE"');
    expect(page).toContain("userId: target.id");
    expect(page).toContain("confirmation,");
    expect(page).toContain("onClick={() => void deleteAccount()}");
    expect(page).not.toContain("setTimeout(");
    expect(page).not.toContain("setInterval(");
  });

  it("preserves every client-side deletion barrier and literal technical confirmation", () => {
    const page = read("app/founder/cleanup/page.tsx");
    expect(page).toContain("if (user.protected) return;");
    expect(page).toContain("disabled={user.protected}");
    expect(page).toContain("SUPPRIMER {target.id}");
    expect(page).toContain('confirmation !== `SUPPRIMER ${target.id}`');
    expect(page).toContain("disabled={deleting || confirmation !== `SUPPRIMER ${target.id}`}");
  });

  it("keeps server evidence verbatim but does not reflect backend errors", () => {
    const page = read("app/founder/cleanup/page.tsx");
    expect(page).toContain("{reason}");
    expect(page).toContain("profile.name || profile.id");
    expect(page).toContain("target.email || target.id");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("body.protectionReasons");
    expect(page).not.toContain("loadError.message");
    expect(page).not.toContain("deleteError.message");
    expect(page).not.toContain("instanceof Error");
  });

  it("keeps destructive server-side revalidation outside this presentation lot", () => {
    const route = read("app/api/founder/accounts-cleanup/route.ts");
    expect(route).toContain("export async function DELETE");
    expect(route).toContain('`SUPPRIMER ${userId}`');
    expect(route).toContain("KLYX_FOUNDER_USER_IDS");
    expect(route).toContain("KLYX_ADMIN_USER_IDS");
    expect(route).toContain("deleteUser");
  });
});
