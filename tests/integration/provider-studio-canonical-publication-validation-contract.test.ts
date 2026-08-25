import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const coreSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/studio/studio-route-core.ts"),
  "utf8"
);

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/studio/route.ts"),
  "utf8"
);

describe("KLYX canonical provider publication validation contract", () => {
  it("keeps canonical-zone preflight before the studio core mutation", () => {
    const preflightIndex = routeSource.indexOf(
      "await providerPublicationZonePreflight(request.clone())"
    );
    const mutationIndex = routeSource.indexOf("return corePut(request)");

    expect(preflightIndex).toBeGreaterThan(-1);
    expect(mutationIndex).toBeGreaterThan(preflightIndex);
    expect(routeSource).toContain("if (preflight) return preflight;");
  });

  it("does not use legacy city or service-area metadata as publication gates", () => {
    expect(coreSource).not.toContain(
      "if (!service.city || service.serviceArea.length === 0)"
    );
    expect(coreSource).not.toContain(
      "Impossible de publier : ajoute une ville et une zone à chaque service actif."
    );
  });

  it("preserves the non-geographic publication completeness gates", () => {
    expect(coreSource).toContain("enabledServices.length === 0");
    expect(coreSource).toContain(
      "service.title.length < 5 || service.description.length < 30"
    );
    expect(coreSource).toContain(
      "!service.availability.some((day) => day.enabled)"
    );
    expect(coreSource).toContain("selectedPrice === null");
    expect(coreSource).toContain("invalidHourly || invalidFixed");
  });

  it("keeps legacy location fields as compatibility metadata only", () => {
    expect(coreSource).toContain("city: service.city || null");
    expect(coreSource).toContain("service_area: service.serviceArea");
    expect(coreSource).toContain("travel_radius_km: service.travelRadiusKm");
    expect(coreSource).toContain("city: serviceProfile?.city ?? profile.city ?? \"Bruxelles\"");
    expect(coreSource).toContain("serviceArea:");
  });
});
