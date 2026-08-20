import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const lifecycle = fs
  .readFileSync(
    path.join(process.cwd(), "scripts/golden-path-service-lifecycle.mjs"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX golden path temporal guard probe", () => {
  it("proves future tracking is rejected before time travel", () => {
    const probeMarker = "KLYX_GOLDEN_PATH_TEMPORAL_GUARD_PROBE";
    const rejection = "expectedStatuses: [409]";
    const timeTravel = "const historicalDate = brusselsDateOffset(-1);";

    expect(lifecycle).toContain(probeMarker);
    expect(lifecycle).toContain(rejection);
    expect(lifecycle).toContain('action: "en_route"');
    expect(lifecycle).toContain('includes("jour prévu")');
    expect(lifecycle.indexOf(rejection)).toBeLessThan(
      lifecycle.indexOf(timeTravel)
    );
  });

  it("moves time only inside the already-isolated ephemeral database", () => {
    expect(lifecycle).toContain("assertGoldenPathIsolation");
    expect(lifecycle).toContain("if (!localSupabase)");
    expect(lifecycle).toContain("const historicalDate = brusselsDateOffset(-1);");
    expect(lifecycle).toContain('booking_date: historicalDate');
    expect(lifecycle).toContain('start_time: "10:00"');
    expect(lifecycle).toContain('end_time: "12:00"');
    expect(lifecycle).toContain('.eq("payment_status", "paid")');
  });

  it("continues through real tracking APIs only after the temporal fixture", () => {
    const timeTravel = "const historicalDate = brusselsDateOffset(-1);";
    const realTracking =
      'for (const action of ["en_route", "arrived", "in_progress"])';

    expect(lifecycle).toContain(realTracking);
    expect(lifecycle.indexOf(timeTravel)).toBeLessThan(
      lifecycle.indexOf(realTracking)
    );
    expect(lifecycle).toContain('action: "provider_finished"');
    expect(lifecycle).toContain('action: "client_confirmed"');
  });
});
