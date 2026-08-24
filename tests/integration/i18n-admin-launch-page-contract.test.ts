import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin launch i18n contract", () => {
  it("localizes the launch presentation without changing probe semantics", () => {
    const page = read("app/admin/launch/page.tsx");

    expect(page).toContain("KLYX_ADMIN_LAUNCH_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxAdminLaunch");
    expect(page).toContain("getKlyxAdminLaunchProbeCopy");
    expect(page).not.toContain("Centre de lancement KLYX");
    expect(page).not.toContain("Relancer l’audit");
  });

  it("preserves every launch probe path and blocking flag", () => {
    const page = read("app/admin/launch/page.tsx");

    expect(page).toContain('{ id: "home", path: "/", blocking: true }');
    expect(page).toContain('{ id: "login", path: "/login", blocking: true }');
    expect(page).toContain('{ id: "signup", path: "/signup", blocking: true }');
    expect(page).toContain('{ id: "install", path: "/install", blocking: true }');
    expect(page).toContain('{ id: "manifest", path: "/manifest.webmanifest", blocking: true }');
    expect(page).toContain('{ id: "service-worker", path: "/sw.js", blocking: true }');
    expect(page).toContain('{ id: "offline", path: "/offline", blocking: true }');
    expect(page).toContain('path: "/api/admin/verifications"');
    expect(page).toContain('path: "/api/admin/skill-verifications"');
    expect(page).toContain('path: "/api/admin/stripe-readiness"');
    expect(page).toContain('path: "/api/admin/sumsub"');
    expect(page).toContain("blocking: false");
    expect(page).toContain("optional: true");
  });

  it("keeps the audit GET-only and preserves authenticated no-store probes", () => {
    const page = read("app/admin/launch/page.tsx");

    expect(page).toContain('fetch("/api/admin/access", {');
    expect(page).toContain("fetch(probe.path, {");
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).toContain("Promise.all(");
    expect(page).toContain("PROBES.map(async (probe)");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
  });

  it("preserves explicit rerun and exact readiness mathematics", () => {
    const page = read("app/admin/launch/page.tsx");

    expect(page).toContain("onClick={() => void runAudit()}");
    expect(page).toContain("void runAudit();");
    expect(page).toContain('const blocking = checks.filter((item) => item.blocking);');
    expect(page).toContain('blocking.filter((item) => item.status === "error").length');
    expect(page).toContain("ready: checks.length > 0 && blockingErrors === 0");
    expect(page).toContain('status: ok ? "ok" : probe.optional ? "warning" : "error"');
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("does not reflect backend or network exception messages", () => {
    const page = read("app/admin/launch/page.tsx");

    expect(page).not.toContain("accessBody.error");
    expect(page).not.toContain("probeError.message");
    expect(page).not.toContain("auditError.message");
    expect(page).not.toContain("error instanceof Error");
    expect(page).toContain('setErrorKey("accessDenied")');
    expect(page).toContain('setErrorKey("auditError")');
    expect(page).toContain("httpStatus: null");
  });
});
