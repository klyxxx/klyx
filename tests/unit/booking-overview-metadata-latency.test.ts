import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/bookings/overview/route.ts"),
  "utf8"
);

describe("booking overview metadata latency", () => {
  it("loads profile and service metadata in parallel", () => {
    const profileIdsIndex = route.indexOf("const profileIds =");
    const metadataPromiseIndex = route.indexOf("await Promise.all([", profileIdsIndex);
    const profilesIndex = route.indexOf('.from("profiles")', metadataPromiseIndex);
    const servicesIndex = route.indexOf('.from("services")', metadataPromiseIndex);
    const profileMapIndex = route.indexOf("const profileMap =", servicesIndex);

    expect(profileIdsIndex).toBeGreaterThanOrEqual(0);
    expect(metadataPromiseIndex).toBeGreaterThan(profileIdsIndex);
    expect(profilesIndex).toBeGreaterThan(metadataPromiseIndex);
    expect(servicesIndex).toBeGreaterThan(metadataPromiseIndex);
    expect(profileMapIndex).toBeGreaterThan(profilesIndex);
    expect(profileMapIndex).toBeGreaterThan(servicesIndex);

    const metadataBlock = route.slice(metadataPromiseIndex, profileMapIndex);
    expect(metadataBlock).toContain("profileIds.size ===");
    expect(metadataBlock).toContain("serviceIds.size ===");
  });
});
