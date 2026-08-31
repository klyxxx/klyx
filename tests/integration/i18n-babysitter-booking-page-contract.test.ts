import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX babysitter booking compatibility contract", () => {
  it("routes a legacy babysitter booking URL into the canonical provider booking", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).toContain("KLYX_BABYSITTER_BOOKING_COMPATIBILITY_ROUTE");
    expect(page).toContain('import { redirect } from "next/navigation"');
    expect(page).toContain("params: Promise<{ id: string }>");
    expect(page).toContain("searchParams: Promise<SearchParams>");
    expect(page).toContain('query.set("service", "babysitting")');
    expect(page).toContain(
      'redirect(`/providers/${encodeURIComponent(id)}/book?${query.toString()}`)'
    );
  });

  it("preserves historical query parameters and repeated values", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).toContain("Object.entries(sourceParams)");
    expect(page).toContain('typeof value === "string"');
    expect(page).toContain("Array.isArray(value)");
    expect(page).toContain("query.append(key, value)");
    expect(page).toContain("query.append(key, item)");
  });

  it("contains no parallel data loading or booking mutation logic", () => {
    const page = read("app/babysitters/[id]/page.tsx");

    expect(page).not.toContain('"use client"');
    expect(page).not.toContain("supabase");
    expect(page).not.toContain("useKlyxLocale");
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("/api/bookings/create");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain("availability_slots");
    expect(page).not.toContain("service_profiles");
  });

  it("keeps child-count validation and the historical message prefix in the canonical flow", () => {
    const canonical = read("app/providers/[id]/book/page.tsx");

    expect(canonical).toContain("Number.isNaN(childrenCount)");
    expect(canonical).toContain("!Number.isInteger(childrenCount)");
    expect(canonical).toContain("childrenCount < 1");
    expect(canonical).toContain("`Nombre d'enfants : ${childrenCount}`");
    expect(canonical).toContain("message: bookingMessage");
  });
});
