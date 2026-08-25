import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const searchCore = readRepoFile(
  "app/api/search/providers/providers-route-core.ts"
);
const zoneCoverage = readRepoFile("lib/provider-search-zone-coverage.ts");

describe("provider search canonical zone contract", () => {
  it("loads canonical zone geography needed for distance matching", () => {
    expect(searchCore).toContain('.from("provider_service_zones")');
    expect(searchCore).toContain(
      '"profile_id, user_service_id, country_code, locality, postal_code, radius_km, is_active"'
    );
    expect(searchCore).toContain("zonesByUserService");
  });

  it("uses canonical zones instead of legacy service-profile text for location matching", () => {
    expect(searchCore).toContain("providerZonesCoverBelgianLocality(candidate.zones, city)");
    expect(searchCore).not.toContain("normalizeLocation(city)");
    expect(searchCore).not.toContain("[candidate.city, ...candidate.serviceArea]");
  });

  it("keeps the public response compatible without exposing internal zone rows", () => {
    expect(searchCore).toContain("const { slots, zones, ...provider } = candidate;");
    expect(searchCore).toContain("city: serviceProfile.city ?? \"\"");
    expect(searchCore).toContain("serviceArea: serviceProfile.service_area ?? []");
    expect(searchCore).toContain("travelRadiusKm: Number(serviceProfile.travel_radius_km ?? 10)");
  });

  it("keeps canonical matching Belgium-only and fail-closed", () => {
    expect(zoneCoverage).toContain("BELGIAN_LOCALITIES_COUNTRY_CODE");
    expect(zoneCoverage).toContain("findBelgianLocality(requestedLocalityInput)");
    expect(zoneCoverage).toContain("if (!requestedLocality) return false");
    expect(zoneCoverage).toContain("distanceBetweenLocalitiesKm");
    expect(zoneCoverage).toContain("coverageStatus(distanceKm, zone.radiusKm).covered");
    expect(zoneCoverage).toContain("value >= 1 && value <= 100");
  });
});
