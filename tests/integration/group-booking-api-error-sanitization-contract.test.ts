import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX group booking API error sanitization contract", () => {
  it("keeps the public route behind a secure 5xx boundary", () => {
    const source = read(
      "app/api/market/requests/[id]/group-booking/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./group-booking-core"');
    expect(source).toContain("secureCoreResponse(");
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"market_group_booking_create_failed"');
    expect(source).toContain(
      '"KLYX_MARKET_GROUP_BOOKING_CREATE_FAILED"'
    );
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves stale-provider recovery in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/group-booking/group-booking-core.ts"
    );

    expect(source).toContain("KLYX_GROUP_STALE_PROVIDER_RECOVERY_12_97");
    expect(source).toContain("KLYX_GROUP_LIVE_COVERAGE_REQUIRED");
    expect(source).toContain("GROUP_PROVIDER_AVAILABILITY_CHANGED");
    expect(source).toContain("GROUP_PROVIDER_RETRY_REQUIRED");
    expect(source).toContain("GROUP_PROVIDER_RECOVERY_FAILED");
  });

  it("preserves safe group-booking business responses", () => {
    const source = read(
      "app/api/market/requests/[id]/group-booking/group-booking-core.ts"
    );

    expect(source).toContain('"Offre manquante."');
    expect(source).toContain('"Demande KLYX introuvable."');
    expect(source).toContain('"Offre introuvable."');
    expect(source).toContain("pending_provider");
    expect(source).toContain("automaticPayment");
  });

  it("confines raw provider messages to the non-route core module", () => {
    const route = read(
      "app/api/market/requests/[id]/group-booking/route.ts"
    );
    const core = read(
      "app/api/market/requests/[id]/group-booking/group-booking-core.ts"
    );

    expect(route).not.toContain("requestError.message");
    expect(route).not.toContain("coverageError.message");
    expect(route).not.toContain("candidateError.message");
    expect(core).toContain("requestError.message");
  });
});
