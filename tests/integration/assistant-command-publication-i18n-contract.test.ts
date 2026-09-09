import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const commandBar = readFileSync(
  "app/components/AssistantCommandBar.tsx",
  "utf8"
);
const thread = readFileSync(
  "app/components/assistant/AssistantThread.tsx",
  "utf8"
);
const readySummary = readFileSync(
  "app/components/assistant/ReadyForSearchSummary.tsx",
  "utf8"
);

describe("assistant Phase B publication boundary", () => {
  it("keeps AssistantCommandBar as a compatibility wrapper around the conversational thread", () => {
    expect(commandBar).toContain("AssistantThread");
    expect(commandBar).toContain("<AssistantThread />");
  });

  it("stops D01-D03 before confirmation or market publication", () => {
    for (const forbidden of [
      "/api/brain/confirm-request",
      "/api/brain/market-publish",
      "confirmation.confirmationId",
      "confirmed: true",
      "setPublishedHref",
      "publishedHref",
      "flowCopy.viewTracking",
    ]) {
      expect(thread).not.toContain(forbidden);
      expect(commandBar).not.toContain(forbidden);
    }
  });

  it("keeps ready_for_search informational and non-transactional", () => {
    expect(thread).toContain('"ready_for_search"');
    expect(thread).toContain("nextPayload?.readiness?.summary");
    expect(readySummary).toContain("Je peux chercher maintenant.");
    expect(readySummary).not.toContain("<button");
    expect(readySummary).not.toContain("/recommendations");
    expect(readySummary).not.toContain("/providers");
  });

  it("does not reset the active thread after a publication because Phase B never publishes", () => {
    expect(thread).not.toContain("published.href");
    expect(thread).not.toContain('router.push(published.href || "/bookings")');
    expect(thread).not.toContain('fetch("/api/brain/market-publish"');
  });
});
