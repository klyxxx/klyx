import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const activitySource = fs.readFileSync(
  path.join(process.cwd(), "app/bookings/page.tsx"),
  "utf8"
);

const splitMissionSource = fs.readFileSync(
  path.join(process.cwd(), "app/bookings/SplitMissionSection.tsx"),
  "utf8"
);

describe("client Activity UX", () => {
  it("keeps client and provider contexts separated", () => {
    expect(activitySource).toContain('router.replace("/provider/jobs")');
    expect(activitySource).not.toContain("KLYX_PROVIDER_MISSION_COCKPIT_13_79");
    expect(activitySource).not.toContain('href="/provider/assistant"');
  });

  it("keeps the client Activity entry point focused on KLYX", () => {
    expect(activitySource).toContain('t("clientTracking")');
    expect(activitySource).toContain('t("organizeAnotherNeed")');
    expect(activitySource).toContain('href="/assistant"');
    expect(activitySource).not.toContain('href="/search"');
  });

  it("uses the Aura Noir semantic KLYX identity without legacy brand colors", () => {
    for (const source of [activitySource, splitMissionSource]) {
      expect(source).toContain("text-primary");
      expect(source).toContain("border-primary");
      expect(source).toContain("bg-accent/40");
      expect(source).not.toMatch(
        /\b(?:bg|text|border|ring|from|via|to)-(?:blue|violet|indigo|fuchsia)-/
      );
      expect(source).not.toMatch(/\bbg-gradient-/);
    }
  });

  it("keeps grouped mission details progressively disclosed", () => {
    expect(splitMissionSource).toContain("<details");
    expect(splitMissionSource).toContain("<summary");
    expect(splitMissionSource).toContain('href={"/bookings/split/" + mission.batchId}');
  });
});
