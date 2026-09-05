import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const zonesPage = readFileSync(
  join(process.cwd(), "app/provider/zones/page.tsx"),
  "utf8"
);

describe("provider zones branding contract", () => {
  it("uses the exact KLYX blue for normal zones accents", () => {
    expect(zonesPage).toContain("text-[#2563EB]");
    expect(zonesPage).toContain("bg-[#2563EB]");
    expect(zonesPage).toContain("bg-[#2563EB]/8");
    expect(zonesPage).toContain("accent-[#2563EB]");

    for (const legacyClass of [
      "text-blue-600",
      "text-blue-700",
      "text-blue-400",
      "text-blue-300",
      "bg-blue-600",
      "bg-blue-500",
      "accent-blue-600",
    ]) {
      expect(zonesPage).not.toContain(legacyClass);
    }
  });

  it("preserves semantic states and the provider zones API boundary", () => {
    expect(zonesPage).toContain("red-500");
    expect(zonesPage).toContain("amber-500");
    expect(zonesPage).toContain("emerald-500");

    expect(zonesPage).toContain("supabase.auth.getSession()");
    expect(zonesPage).toContain('fetch("/api/provider/zones"');
    expect(zonesPage).toContain('method: "POST"');
    expect(zonesPage).toContain('method: "PATCH"');
    expect(zonesPage).toContain('method: "DELETE"');
  });
});
