import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/planning/page.tsx"),
  "utf8"
);

describe("provider planning UX", () => {
  it("keeps planning timeline-first instead of dashboard-first", () => {
    expect(source).toContain("data.planning?.map((day)");
    expect(source).toContain('href={`/bookings/${booking.id}`}');
    expect(source).not.toContain("function SummaryCard(");
    expect(source).not.toContain("bg-[linear-gradient");
  });

  it("uses KLYX blue for identity and semantic colors only for real states", () => {
    expect(source).toContain("text-[#2563EB]");
    expect(source).not.toContain("text-blue-");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
  });

  it("keeps planning read-only and explicit", () => {
    expect(source).toContain('t("noAutomaticChanges")');
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });
});
