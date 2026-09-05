import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("provider missions UX", () => {
  it("keeps Missions action-first instead of dashboard-first", () => {
    const source = read("app/provider/jobs/page.tsx");

    expect(source).toContain("recommendedRequest");
    expect(source).toContain("MissionCard");
    expect(source).toContain('t("bestMatch")');
    expect(source).not.toContain("function Stat(");
    expect(source).not.toContain("function TrackingCard(");
  });

  it("uses the single-blue KLYX visual language", () => {
    const source = read("app/provider/jobs/page.tsx");

    expect(source).toContain("#2563EB");
    expect(source).not.toContain("bg-blue-600");
    expect(source).not.toContain("text-blue-600");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
    expect(source).not.toContain("border-violet-");
  });

  it("keeps explicit provider confirmation for offers", () => {
    const source = read("app/provider/jobs/page.tsx");

    expect(source).toContain("submitOffer");
    expect(source).toContain('method: "POST"');
    expect(source).toContain('t("offerNotBookingPayment")');
  });
});
