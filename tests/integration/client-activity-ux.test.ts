import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const activitySource = read("app/bookings/page.tsx");
const marketActivitySource = read(
  "app/bookings/ClientMarketActivitySection.tsx"
);
const splitMissionSource = read("app/bookings/SplitMissionSection.tsx");
const requestsSource = read("app/requests/page.tsx");

describe("client Activity UX", () => {
  it("keeps client and provider contexts separated", () => {
    expect(activitySource).toContain('router.replace("/provider/jobs")');
    expect(activitySource).not.toContain("KLYX_PROVIDER_MISSION_COCKPIT_13_79");
    expect(activitySource).not.toContain('href="/provider/assistant"');
  });

  it("consolidates requests offers bookings and grouped missions in Activity", () => {
    expect(activitySource).toContain('fetch("/api/market/requests"');
    expect(activitySource).toContain("<ClientMarketActivitySection");
    expect(activitySource).toContain("<SplitMissionSection");
    expect(activitySource).toContain('kind: "market"');
    expect(activitySource).toContain('kind: "booking"');
    expect(activitySource).toContain('kind: "split"');
    expect(requestsSource).toContain('redirect("/bookings")');
  });

  it("keeps one primary next action across the whole client lifecycle", () => {
    expect(activitySource).toContain('t("nextStepKlyx")');
    expect(activitySource).toContain("marketRequestNeedsAction");
    expect(activitySource).toContain("splitMissionNeedsAction");
    expect(activitySource).toContain("booking.actionRequired");
    expect(activitySource).toContain("candidates.sort");
    expect(activitySource).toContain('href="/assistant"');
    expect(activitySource).not.toContain('href="/search"');
    expect(activitySource).toContain('t("explicitConfirmationBoundary")');
  });

  it("does not strand clients on an empty action filter", () => {
    expect(activitySource).toContain("initialFilterResolvedRef");
    expect(activitySource).toContain(
      'if (counts.actions === 0 && counts.upcoming > 0)'
    );
    expect(activitySource).toContain('setFilter("upcoming")');
  });

  it("keeps provider choice explicit and limits visible recommendations", () => {
    expect(marketActivitySource).toContain(".slice(0, 3)");
    expect(marketActivitySource).toContain('action: "accept" | "reject"');
    expect(marketActivitySource).toContain(
      'void onOfferAction(request.id, offer.id, "accept")'
    );
    expect(marketActivitySource).toContain(
      'void onOfferAction(request.id, offer.id, "reject")'
    );
    expect(marketActivitySource).toContain("onCancelRequest");
    expect(marketActivitySource).toContain("<details");
    expect(marketActivitySource).toContain("<summary");
  });

  it("uses one KLYX blue identity without legacy violet activity styling", () => {
    expect(activitySource).toContain("bg-blue-600");
    expect(activitySource).toContain("text-blue-600");
    expect(activitySource).not.toContain("bg-violet-");
    expect(activitySource).not.toContain("text-violet-");
    expect(marketActivitySource).not.toContain("bg-violet-");
    expect(marketActivitySource).not.toContain("text-violet-");
    expect(splitMissionSource).not.toContain("bg-violet-");
    expect(splitMissionSource).not.toContain("text-violet-");
  });

  it("keeps grouped mission details progressively disclosed", () => {
    expect(splitMissionSource).toContain("<details");
    expect(splitMissionSource).toContain("<summary");
    expect(splitMissionSource).toContain(
      'href={"/bookings/split/" + mission.batchId}'
    );
  });
});
