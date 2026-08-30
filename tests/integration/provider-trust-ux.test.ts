import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/provider/trust/page.tsx"),
  "utf8"
);

describe("provider trust UX", () => {
  it("keeps trust action-first without the old dashboard hero", () => {
    expect(source).toContain('href="/trust/new"');
    expect(source).toContain('t("reportClient")');
    expect(source).toContain("DisputeSection");
    expect(source).not.toContain("bg-[linear-gradient");
    expect(source).not.toContain("rounded-[2rem]");
  });

  it("keeps disputes read-only on this page and links back to the mission", () => {
    expect(source).toContain('fetch("/api/disputes"');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain('href={`/bookings/${dispute.booking_id}`}');
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });

  it("uses KLYX blue for identity and semantic colors only for real states", () => {
    expect(source).toContain("bg-blue-600");
    expect(source).toContain("text-blue-600");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
    expect(source).toContain("amber-500");
    expect(source).toContain("emerald-500");
  });
});
