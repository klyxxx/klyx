import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/zones/page.tsx"),
  "utf8"
);

describe("provider zones UX", () => {
  it("keeps the add-zone action clear without a dashboard hero", () => {
    expect(source).toContain('t("addTitle")');
    expect(source).toContain('t("addZone")');
    expect(source).not.toContain("bg-[linear-gradient");
    expect(source).not.toContain("text-cyan-");
    expect(source).not.toContain("bg-cyan-");
  });

  it("keeps zone mutations explicit", () => {
    expect(source).toContain('method: "POST"');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('method: "DELETE"');
    expect(source).toContain('window.confirm(t("confirmDelete"))');
  });

  it("uses one exact KLYX blue identity with semantic state colors", () => {
    expect(source).toContain("bg-[#2563EB]");
    expect(source).toContain("bg-[#2563EB]/8");
    expect(source).toContain("text-[#2563EB]");
    expect(source).toContain("accent-[#2563EB]");

    for (const legacyClass of [
      "bg-blue-600",
      "bg-blue-500",
      "text-blue-700",
      "text-blue-600",
      "text-blue-400",
      "text-blue-300",
      "accent-blue-600",
    ]) {
      expect(source).not.toContain(legacyClass);
    }

    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
    expect(source).toContain("emerald-500");
    expect(source).toContain("red-500");
  });
});
