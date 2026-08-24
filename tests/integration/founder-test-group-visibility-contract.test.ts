import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder test-center group visibility", () => {
  it("renders security and beta groups returned by the diagnostic API", () => {
    const page = read("app/founder/test/page.tsx");
    const route = read("app/api/founder/test-center/route.ts");

    expect(route).toContain('"Sécurité"');
    expect(route).toContain('"Beta 12.6"');
    expect(page).toContain('"Sécurité"');
    expect(page).toContain('"Beta 12.6"');
  });

  it("does not silently hide future diagnostic groups", () => {
    const page = read("app/founder/test/page.tsx");
    expect(page).toContain("const remainingNames = Array.from(map.keys()).filter(");
    expect(page).toContain("!GROUP_ORDER.includes(group)");
    expect(page).toContain("return [...orderedNames, ...remainingNames].map((group) => ({");
  });

  it("preserves non-destructive GET-only diagnostic execution", () => {
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
});
