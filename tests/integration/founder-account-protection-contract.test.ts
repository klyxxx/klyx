import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder account protection contract", () => {
  it("keeps the read-only audit aligned with Founder and Admin configured protection", () => {
    const audit = read("app/api/founder/accounts-audit/route.ts");

    expect(audit).toContain("export async function GET()");
    expect(audit).not.toContain("export async function DELETE");
    expect(audit).toContain("process.env.KLYX_FOUNDER_USER_IDS");
    expect(audit).toContain("process.env.KLYX_ADMIN_USER_IDS");
    expect(audit).toContain("protectedConfiguredIds()");
    expect(audit).toContain("protectedIds.has(user.id)");
    expect(audit).toContain('reasons.push("UID déclaré Founder ou Admin")');
    expect(audit).toContain("const protectedAccount = reasons.length > 0");
    expect(audit).toContain("unreferencedUsers: users.filter((user) => !user.protected).length");
  });

  it("keeps destructive cleanup protected by the same configured account classes", () => {
    const cleanup = read("app/api/founder/accounts-cleanup/route.ts");

    expect(cleanup).toContain("process.env.KLYX_FOUNDER_USER_IDS");
    expect(cleanup).toContain("process.env.KLYX_ADMIN_USER_IDS");
    expect(cleanup).toContain("protectedConfiguredIds().has(userId)");
    expect(cleanup).toContain('reasons.push("UID déclaré Founder ou Admin")');
    expect(cleanup).toContain("confirmation !== `SUPPRIMER ${userId}`");
    expect(cleanup).toContain("const reasons = await protectionReasons(");
    expect(cleanup).toContain("if (reasons.length > 0)");
    expect(cleanup).toContain("supabaseAdmin.auth.admin.deleteUser(");
  });
});
