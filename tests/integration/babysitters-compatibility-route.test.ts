import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX babysitters compatibility route", () => {
  it("routes the legacy babysitters entry into canonical recommendations", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain("KLYX_BABYSITTERS_COMPATIBILITY_ROUTE");
    expect(page).toContain('import { redirect } from "next/navigation"');
    expect(page).toContain("searchParams: Promise<SearchParams>");
    expect(page).toContain("const sourceParams = await searchParams;");
    expect(page).toContain("const params = new URLSearchParams();");
    expect(page).toContain('params.set("service", "babysitting")');
    expect(page).toContain('redirect(`/recommendations?${params.toString()}`)');
  });

  it("preserves historical query parameters including city and repeated values", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain("Object.entries(sourceParams)");
    expect(page).toContain('typeof value === "string"');
    expect(page).toContain("Array.isArray(value)");
    expect(page).toContain("params.append(key, value)");
    expect(page).toContain("params.append(key, item)");
    expect(page).not.toContain('params.set("location"');
    expect(page).not.toContain('params.delete("city"');
  });

  it("contains no legacy marketplace, provider loading, or mutation logic", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("/api/search/providers");
    expect(page).not.toContain("/api/services/public");
    expect(page).not.toContain("klyxScore");
    expect(page).not.toContain("reviewCount");
    expect(page).not.toContain("/providers/");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });
});
