import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const route = readRepoFile("app/api/provider/studio/route.ts");
const preflight = readRepoFile("lib/provider-publication-zone-readiness.ts");
const goldenPath = readRepoFile("scripts/golden-path-provider-onboarding.mjs");

describe("provider publication canonical zone contract", () => {
  it("runs the canonical-zone preflight before the studio mutation", () => {
    const guard = "providerPublicationZonePreflight(request.clone())";
    const mutation = "return corePut(request)";

    expect(route).toContain(guard);
    expect(route).toContain(mutation);
    expect(route.indexOf(guard)).toBeLessThan(route.indexOf(mutation));
  });

  it("checks owned enabled provider services and active BE zones fail-closed", () => {
    expect(preflight).toContain('getAuthenticatedProfile(request)');
    expect(preflight).toContain('requireAccountType(profile, "provider")');
    expect(preflight).toContain('.from("user_services")');
    expect(preflight).toContain('.eq("user_id", profile.id)');
    expect(preflight).toContain('.eq("provider_enabled", true)');
    expect(preflight).toContain('.from("provider_service_zones")');
    expect(preflight).toContain('.eq("profile_id", profile.id)');
    expect(preflight).toContain('.eq("is_active", true)');
    expect(preflight).toContain("BELGIAN_LOCALITIES_COUNTRY_CODE");
  });

  it("requires a persisted service draft and a zone for every enabled service", () => {
    expect(preflight).toContain("KLYX_PROVIDER_SERVICE_DRAFT_REQUIRED");
    expect(preflight).toContain("KLYX_PROVIDER_ACTIVE_ZONE_REQUIRED");
    expect(preflight).toContain("serviceIds.some(");
    expect(preflight).toContain("serviceIds.find(");
    expect(preflight).toContain("readyUserServiceIds.has(userServiceId)");
  });

  it("does not gate draft saves on canonical zones", () => {
    expect(preflight).toContain("if (body.publish !== true) return null");
  });

  it("proves draft then canonical zone then publication in the Golden Path", () => {
    const draft = '"PUT /api/provider/studio draft"';
    const zone = '"POST /api/provider/zones"';
    const publish = '"PUT /api/provider/studio publish"';

    expect(goldenPath).toContain("publish: false");
    expect(goldenPath).toContain("publish: true");
    expect(goldenPath.indexOf(draft)).toBeLessThan(goldenPath.indexOf(zone));
    expect(goldenPath.indexOf(zone)).toBeLessThan(goldenPath.indexOf(publish));
  });
});
