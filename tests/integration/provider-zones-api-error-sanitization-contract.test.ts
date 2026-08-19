import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("provider zones API error sanitization contract", () => {
  it("keeps the zones business logic in the core and sanitizes unexpected 5xx responses", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/zones/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/zones/zones-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain("response.status < 500");
    expect(route).toContain('event: "provider_zones_request_failed"');
    expect(route).toContain('code: "KLYX_PROVIDER_ZONES_REQUEST_FAILED"');
    expect(route).toContain("coreGet");
    expect(route).toContain("corePost");
    expect(route).toContain("corePatch");
    expect(route).toContain("coreDelete");
    expect(route).not.toContain("error.message");

    expect(core).toContain("KLYX_PROVIDER_ZONE_COUNTRY_PHASE_5G");
    expect(core).toContain("KLYX_PROFILE_COUNTRY_REQUIRED");
    expect(core).toContain("KLYX_LOCALITY_CATALOG_NOT_AVAILABLE");
    expect(core).toContain("findBelgianLocality");
    expect(core).toContain("provider_service_zones");
  });
});
