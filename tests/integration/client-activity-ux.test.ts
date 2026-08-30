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

  it("keeps the next client action primary and returns new needs to KLYX", () => {
    expect(activitySource).toContain('t("nextStepKlyx")');
    expect(activitySource).toContain('href="/assistant"');
    expect(activitySource).not.toContain('href="/search"');
    expect(activitySource).toContain('t("explicitConfirmationBoundary")');
  });

  it("uses one KLYX blue identity without old violet activity styling", () => {
    expect(activitySource).toContain("bg-blue-600");
    expect(activitySource).toContain("text-blue-600");
    expect(activitySource).not.toContain("bg-violet-");
    expect(activitySource).not.toContain("text-violet-");
    expect(splitMissionSource).not.toContain("bg-violet-");
    expect(splitMissionSource).not.toContain("text-violet-");
  });

  it("keeps grouped mission details progressively disclosed", () => {
    expect(splitMissionSource).toContain("<details");
    expect(splitMissionSource).toContain("<summary");
    expect(splitMissionSource).toContain('href={"/bookings/split/" + mission.batchId}');
  });
});
