import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX founder home i18n contract", () => {
  it("localizes founder presentation and does not reflect backend errors", () => {
    const page = read("app/founder/page.tsx");
    expect(page).toContain("KLYX_FOUNDER_HOME_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
  });

  it("preserves read-only founder status and exact explicit profile switch", () => {
    const page = read("app/founder/page.tsx");
    expect(page).toContain('fetch("/api/founder/status", { cache: "no-store" })');
    expect(page).toContain('fetch("/api/profiles/active", {');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("body: JSON.stringify({ profileId: profile.id })");
    expect(page).toContain("onClick={action}");
    expect(page).toContain("router.push(destination)");
    expect(page).toContain("router.refresh()");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("preserves all founder destinations", () => {
    const page = read("app/founder/page.tsx");
    for (const href of [
      "/dashboard",
      "/provider",
      "/accounts?new=1&type=client",
      "/accounts?new=1&type=provider",
      "/admin",
      "/founder/analytics",
    ]) {
      expect(page).toContain(`"${href}"`);
    }
  });

  it("keeps GET active profile read-only and POST as the only cookie writer", () => {
    const route = read("app/api/profiles/active/route.ts");
    expect(route).toContain("export async function GET()");
    expect(route).toContain("export async function POST(");
    expect(route).toContain("Seul POST modifie ACTIVE_PROFILE_COOKIE");
    expect(route).toContain("setActiveProfileCookie(");
  });
});
