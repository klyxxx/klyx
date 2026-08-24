import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder final-check i18n contract", () => {
  it("preserves the exact read-only probe surface", () => {
    const page = read("app/founder/final-check/page.tsx");
    for (const target of [
      "/api/founder/status",
      "/api/admin/access",
      "/dashboard",
      "/accounts",
      "/profile",
      "/provider",
      "/admin",
      "/founder",
      "/founder/test",
      "/founder/cleanup",
      "/api/founder/accounts-audit",
      "/api/provider/sumsub/status",
    ]) {
      expect(page).toContain(`\"${target}\"`);
    }
    expect(page).toContain('cache: "no-store"');
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain("setTimeout(");
    expect(page).not.toContain("setInterval(");
  });

  it("preserves manual rerun, automatic initial check and readiness algorithm", () => {
    const page = read("app/founder/final-check/page.tsx");
    expect(page).toContain("onClick={() => void runChecks()}");
    expect(page).toContain("void runChecks();");
    expect(page).toContain("item.blocking && item.status === \"error\"");
    expect(page).toContain("ready: checks.length > 0 && blockers === 0");
    expect(page).toContain('blocking: false');
  });

  it("localizes client-built diagnostics without reflecting backend errors", () => {
    const page = read("app/founder/final-check/page.tsx");
    expect(page).toContain("KLYX_FOUNDER_FINAL_CHECK_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).not.toContain("founder.error");
    expect(page).not.toContain("adminBody.error");
    expect(page).not.toContain("audit.error");
    expect(page).not.toContain("pageError.message");
    expect(page).not.toContain("auditError.message");
    expect(page).not.toContain("checkError.message");
    expect(page).not.toContain("instanceof Error");
  });

  it("keeps the active profile identifier as Founder diagnostic evidence", () => {
    const page = read("app/founder/final-check/page.tsx");
    expect(page).toContain('detail: founder.activeProfileId ?? tr("noActiveProfile")');
  });
});
