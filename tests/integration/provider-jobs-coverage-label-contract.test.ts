import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const liveRevalidation = readFileSync(
  join(process.cwd(), "lib/provider-jobs-live-revalidation.ts"),
  "utf8"
);

describe("provider jobs coverage label contract", () => {
  it("keeps the live coverage ratio language-neutral", () => {
    const coverageStart = liveRevalidation.indexOf("coverage: {");
    const liveEligibilityStart = liveRevalidation.indexOf(
      "liveEligibility:",
      coverageStart
    );

    expect(coverageStart).toBeGreaterThanOrEqual(0);
    expect(liveEligibilityStart).toBeGreaterThan(coverageStart);

    const coverageBlock = liveRevalidation.slice(
      coverageStart,
      liveEligibilityStart
    );

    expect(coverageBlock).toContain("label:");
    expect(coverageBlock).toContain("live.coverageCount");
    expect(coverageBlock).toContain('"/"');
    expect(coverageBlock).toContain("live.slotCount");
    expect(coverageBlock).not.toContain("disponible");
  });
});
