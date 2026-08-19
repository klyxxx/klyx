import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX search API error sanitization contract", () => {
  it("secures provider search 5xx responses", () => {
    const source = read("app/api/search/providers/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./providers-route-core"');
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"provider_search_failed"');
    expect(source).toContain('"KLYX_PROVIDER_SEARCH_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves provider ranking and filtering logic in the core", () => {
    const source = read("app/api/search/providers/providers-route-core.ts");

    expect(source).toContain("loadCandidates");
    expect(source).toContain("compareCandidates");
    expect(source).toContain("availabilityMatches");
    expect(source).toContain("getApprovedUserServiceIds");
  });

  it("secures locality coverage 5xx responses", () => {
    const source = read("app/api/search/coverage/route.ts");

    expect(source).toContain('from "./coverage-route-core"');
    expect(source).toContain('"search_coverage_failed"');
    expect(source).toContain('"KLYX_SEARCH_COVERAGE_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves municipality-center privacy calculations in the coverage core", () => {
    const source = read("app/api/search/coverage/coverage-route-core.ts");

    expect(source).toContain("findBelgianLocality");
    expect(source).toContain("distanceBetweenLocalitiesKm");
    expect(source).toContain('calculationMode: "municipality_centers"');
    expect(source).toContain("KLYX n’utilise ni l’adresse privée ni la position GPS du prestataire");
  });

  it("secures provider coverage 5xx responses", () => {
    const source = read("app/api/search/provider-coverage/route.ts");

    expect(source).toContain('from "./provider-coverage-route-core"');
    expect(source).toContain('"provider_coverage_check_failed"');
    expect(source).toContain('"KLYX_PROVIDER_COVERAGE_CHECK_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves provider service-zone coverage logic in the core", () => {
    const source = read("app/api/search/provider-coverage/provider-coverage-route-core.ts");

    expect(source).toContain("findBelgianLocality");
    expect(source).toContain("coverageStatus");
    expect(source).toContain('from("provider_service_zones")');
    expect(source).toContain('reason: "no_service_zone"');
  });
});
