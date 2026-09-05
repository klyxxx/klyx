import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const baselinePath = path.join(
  process.cwd(),
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
);
const statusRoutePath = path.join(
  process.cwd(),
  "app/api/bookings/status/route.ts"
);

const baseline = fs.readFileSync(baselinePath, "utf8");
const statusRoute = fs.readFileSync(statusRoutePath, "utf8");

describe("provider booking overlap database guard", () => {
  it("serializes acceptance by provider and booking date", () => {
    expect(baseline).toContain("klyx_prevent_provider_booking_overlap");
    expect(baseline).toContain("pg_advisory_xact_lock");
    expect(baseline).toContain("hashtext(provider_profile_id::text)");
    expect(baseline).toContain("hashtext(new.booking_date::text)");
  });

  it("rejects overlapping accepted or completed bookings at DB boundary", () => {
    expect(baseline).toContain("existing.status in ('accepted', 'completed')");
    expect(baseline).toContain("existing.start_time < new.end_time");
    expect(baseline).toContain("existing.end_time > new.start_time");
    expect(baseline).toContain("KLYX_PROVIDER_TIME_CONFLICT");
    expect(baseline).toContain(
      'CREATE OR REPLACE TRIGGER "klyx_prevent_provider_booking_overlap" BEFORE INSERT OR UPDATE OF "provider_id", "babysitter_id", "booking_date", "start_time", "end_time", "status" ON "public"."bookings"'
    );
  });

  it("maps the database conflict to an HTTP 409 in the booking status route", () => {
    expect(statusRoute).toContain('rawMessage.includes(\n      "KLYX_PROVIDER_TIME_CONFLICT"\n    )');
    expect(statusRoute).toContain("const status = conflict ? 409 : apiErrorStatus(message)");
  });
});
