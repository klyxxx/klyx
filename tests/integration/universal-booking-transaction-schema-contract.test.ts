import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260821160000_klyx_universal_booking_transaction_schema.sql"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX universal booking transaction schema", () => {
  it("adds the market snapshot columns used by current quote and booking APIs", () => {
    expect(migration).toContain(
      "alter table public.service_quotes\n  add column if not exists country_code text;"
    );
    expect(migration).toContain(
      "alter table public.service_quotes\n  add column if not exists currency text;"
    );
    expect(migration).toContain(
      "alter table public.bookings\n  add column if not exists country_code text;"
    );
  });

  it("validates universal bookings through the exact user_service binding", () => {
    expect(migration).toContain("if new.user_service_id is not null then");
    expect(migration).toContain("where us.id = new.user_service_id");
    expect(migration).toContain("and us.user_id = provider_profile_id");
    expect(migration).toContain("and us.active = true");
    expect(migration).toContain(
      "and coalesce(us.provider_enabled, true) = true"
    );
  });

  it("keeps only an explicit legacy babysitting fallback", () => {
    expect(migration).toContain(
      "s.slug in ('babysitting', 'baby-sitting')"
    );
    expect(migration.indexOf("if new.user_service_id is not null then")).toBeLessThan(
      migration.indexOf("s.slug in ('babysitting', 'baby-sitting')")
    );
  });
});
