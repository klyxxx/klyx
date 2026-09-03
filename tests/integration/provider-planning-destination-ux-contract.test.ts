import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider Planning destination UX", () => {
  it("keeps planning calm and read-only while preserving the authenticated API contract", () => {
    const planning = read("app/provider/planning/page.tsx");

    expect(planning).toContain("KLYX_PROVIDER_PLANNING_DESTINATION_2026_09_02");
    expect(planning).toContain('<main className="klyx-page">');
    expect(planning).toContain('fetch("/api/provider/planning?days=30"');
    expect(planning).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(planning).toContain('cache: "no-store"');
    expect(planning).toContain('href={`/bookings/${booking.id}`}');

    expect(planning).not.toContain('method: "POST"');
    expect(planning).not.toContain('method: "PATCH"');
    expect(planning).not.toContain('method: "DELETE"');
    expect(planning).not.toContain("shadow-sm");
    expect(planning).not.toContain("bg-red-500");
    expect(planning).not.toContain("bg-amber-500");
    expect(planning).not.toContain("violet");
    expect(planning).not.toContain("indigo");

    expect(planning).toContain("border-red-500/30");
    expect(planning).toContain("border-amber-500/35");
    expect(planning).toContain("border-blue-600/25");
  });
});
