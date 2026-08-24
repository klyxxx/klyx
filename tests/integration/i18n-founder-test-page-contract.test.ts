import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder Test i18n contract", () => {
  it("localizes chrome while preserving diagnostic evidence verbatim", () => {
    const page = read("app/founder/test/page.tsx");
    expect(page).toContain("KLYX_FOUNDER_TEST_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("{check.title}");
    expect(page).toContain("{check.detail}");
    expect(page).toContain("translateKlyxFounderTestGroup(locale, group.name)");
  });

  it("keeps all server groups visible including future groups", () => {
    const page = read("app/founder/test/page.tsx");
    expect(page).toContain('"Sécurité"');
    expect(page).toContain('"Beta 12.6"');
    expect(page).toContain("const remainingNames = Array.from(map.keys()).filter(");
    expect(page).toContain("!GROUP_ORDER.includes(group)");
    expect(page).toContain("[...orderedNames, ...remainingNames]");
  });

  it("preserves GET-only manual diagnostic execution", () => {
    const page = read("app/founder/test/page.tsx");
    const route = read("app/api/founder/test-center/route.ts");
    expect(page).toContain('fetch("/api/founder/test-center", {');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("onClick={() => void runChecks()}");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(route).toContain("export async function GET()");
  });

  it("does not reflect API errors into the Founder UI", () => {
    const page = read("app/founder/test/page.tsx");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("caught.message");
    expect(page).not.toContain("instanceof Error");
  });
});
