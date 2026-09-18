import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260918194500_klyx_group_live_coverage_self_conflict_fix.sql"
  ),
  "utf8"
);

const compact = source.replace(/\s+/g, " ");

describe("KLYX booking-group live coverage self-conflict guard", () => {
  it("excludes only the current group while retaining external accepted/completed conflict checks", () => {
    expect(compact).toContain("v_current_group_id uuid := null");
    expect(compact).toContain("g.market_request_id = p_request_id");
    expect(compact).toContain("g.provider_profile_id = p_provider_profile_id");
    expect(compact).toContain("g.user_service_id = p_user_service_id");
    expect(compact).toContain(
      "b.booking_group_id is distinct from v_current_group_id"
    );
    expect(compact).toContain("b.status in ('accepted', 'completed')");
    expect(compact).toContain("b.start_time < v_slot.end_time");
    expect(compact).toContain("b.end_time > v_slot.start_time");
    expect(compact).toContain("'GROUP_LIVE_BOOKING_CONFLICT'");
  });

  it("keeps the capability server-only", () => {
    expect(compact).toContain(
      "revoke all on function public.klyx_group_live_coverage_check(uuid, uuid, uuid) from public, anon, authenticated"
    );
    expect(compact).toContain(
      "grant execute on function public.klyx_group_live_coverage_check(uuid, uuid, uuid) to service_role"
    );
  });
});
