import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider planning branding contract", () => {
  it("uses the exact KLYX blue without changing planning behavior or semantic states", () => {
    const planning = read("app/provider/planning/page.tsx");

    expect(planning).toContain("KLYX_PROVIDER_PLANNING_DESTINATION_2026_09_02");
    expect(planning).toContain('fetch("/api/provider/planning?days=30"');
    expect(planning).toContain("supabase.auth.getSession()");
    expect(planning).toContain('href={`/bookings/${booking.id}`}');

    expect(planning).toContain("#2563EB");
    for (const legacyAccent of [
      "blue-300",
      "blue-400",
      "blue-500",
      "blue-600",
      "blue-700",
      "violet-",
      "indigo-",
      "#2b1452",
    ]) {
      expect(planning).not.toContain(legacyAccent);
    }

    expect(planning).toContain("red-500");
    expect(planning).toContain("amber-500");
    expect(planning).toContain("emerald-600");
  });
});
