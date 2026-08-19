import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX split fallback slot-map API error sanitization contract", () => {
  it("keeps the public slot-map route behind a secure 5xx boundary", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/slot-map/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./slot-map-core"');
    expect(source).toContain("response.status < 500");
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain('"market_split_fallback_slot_map_failed"');
    expect(source).toContain(
      '"KLYX_MARKET_SPLIT_FALLBACK_SLOT_MAP_FAILED"'
    );
    expect(source).not.toContain("detail:");
  });

  it("preserves exact live slot mapping logic unchanged in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/slot-map/slot-map-core.ts"
    );

    expect(source).toContain("KLYX_MULTI_PROVIDER_EXACT_SLOT_MAP_13_16");
    expect(source).toContain("klyx_group_live_coverage_check");
    expect(source).toContain("verified_ready_for_client_review");
    expect(source).toContain("EXACT_MULTI_PROVIDER_PLAN_AVAILABLE");
    expect(source).toContain("availability_slots_plus_bookings_cross_checked_with_12_96_rpc");
  });

  it("preserves fail-closed split plan safety flags", () => {
    const route = read(
      "app/api/market/requests/[id]/split-fallback/slot-map/route.ts"
    );
    const core = read(
      "app/api/market/requests/[id]/split-fallback/slot-map/slot-map-core.ts"
    );

    expect(route).toContain("splitPlanPossible: false");
    expect(route).toContain("automaticProviderSelection: false");
    expect(route).toContain("automaticBooking: false");
    expect(route).toContain("automaticPayment: false");
    expect(core).toContain("explicitConfirmationRequired:");
    expect(core).toContain("automaticProviderSelection:");
    expect(core).toContain("automaticBooking:");
    expect(core).toContain("automaticPayment:");
  });

  it("confines raw provider error detail to the non-route core module", () => {
    const route = read(
      "app/api/market/requests/[id]/split-fallback/slot-map/route.ts"
    );
    const core = read(
      "app/api/market/requests/[id]/split-fallback/slot-map/slot-map-core.ts"
    );

    expect(route).not.toContain("requestError.message");
    expect(route).not.toContain("slotError.message");
    expect(route).not.toContain("detail:");
    expect(core).toContain("requestError.message");
    expect(core).toContain("slotError.message");
  });
});
