import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX babysitters compatibility contract", () => {
  it("routes the legacy babysitters directory into the canonical recommendations flow", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain('import { redirect } from "next/navigation"');
    expect(page).toContain("KLYX_BABYSITTERS_COMPATIBILITY_ROUTE");
    expect(page).toContain("searchParams: Promise<SearchParams>");
    expect(page).toContain("const sourceParams = await searchParams");
    expect(page).toContain("const params = new URLSearchParams()");
    expect(page).toContain('params.set("service", "babysitting")');
    expect(page).toContain('redirect(`/recommendations?${params.toString()}`)');
  });

  it("preserves historical query parameters, including repeated values", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain("Object.entries(sourceParams)");
    expect(page).toContain('typeof value === "string"');
    expect(page).toContain("params.append(key, value)");
    expect(page).toContain("Array.isArray(value)");
    expect(page).toContain("for (const item of value)");
    expect(page).toContain("params.append(key, item)");
    expect(page).not.toContain("params.delete(");
  });

  it("contains no duplicate marketplace, ranking, provider-card, or direct database logic", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).not.toContain("createClient(");
    expect(page).not.toContain("supabase");
    expect(page).not.toContain(".from(");
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("matchesCity(");
    expect(page).not.toContain("matchesBudget(");
    expect(page).not.toContain("matchesAvailability(");
    expect(page).not.toContain("klyxScore");
    expect(page).not.toContain("completedJobs");
    expect(page).not.toContain("/babysitters/");
  });

  it("remains side-effect free", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain("/api/bookings");
    expect(page).not.toContain("stripe");
  });
});
