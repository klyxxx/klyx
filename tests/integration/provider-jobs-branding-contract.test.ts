import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider jobs branding contract", () => {
  it("uses the exact KLYX blue while preserving jobs and offer behavior", () => {
    const jobs = read("app/provider/jobs/page.tsx");

    expect(jobs).toContain("#2563EB");
    for (const legacyAccent of [
      "blue-300",
      "blue-400",
      "blue-500",
      "blue-600",
      "blue-700",
      "violet-",
      "indigo-",
      "fuchsia-",
      "bg-gradient",
    ]) {
      expect(jobs).not.toContain(legacyAccent);
    }

    expect(jobs).toContain('fetch("/api/provider/jobs"');
    expect(jobs).toContain('"/api/market/requests/" + request.id + "/offers"');
    expect(jobs).toContain('method: "POST"');
    expect(jobs).toContain('Authorization: "Bearer " + accessToken');
    expect(jobs).toContain('request.requestMode === "multi_slot" &&');
    expect(jobs).toContain("!request.coverage?.fullCoverage");
    expect(jobs).toContain("providerMissionPriority(left) - providerMissionPriority(right)");
    expect(jobs).toContain("<ProviderConfirmedMissionsSection");
    expect(jobs).toContain('"/provider/assistant?prompt=" +');
    expect(jobs).toContain("buildKlyxProviderAssistantMissionPrompt(locale");
  });
});
