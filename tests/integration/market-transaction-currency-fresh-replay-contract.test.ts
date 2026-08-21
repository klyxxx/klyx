import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260815033600_klyx_market_transaction_currency.sql"
    ),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX market transaction currency fresh replay", () => {
  it("creates profile market columns before the legacy profile backfill", () => {
    const addCountry = migration.indexOf(
      "add column if not exists country_code text;"
    );
    const addCurrency = migration.indexOf(
      "add column if not exists currency_code text;"
    );
    const profileBackfill = migration.indexOf("update public.profiles");

    expect(addCountry).toBeGreaterThanOrEqual(0);
    expect(addCurrency).toBeGreaterThanOrEqual(0);
    expect(profileBackfill).toBeGreaterThanOrEqual(0);
    expect(addCountry).toBeLessThan(profileBackfill);
    expect(addCurrency).toBeLessThan(profileBackfill);
  });

  it("keeps the profile column additions idempotent", () => {
    expect(migration).toContain(
      "alter table public.profiles\n  add column if not exists country_code text;"
    );
    expect(migration).toContain(
      "alter table public.profiles\n  add column if not exists currency_code text;"
    );
  });

  it("preserves legacy BE/EUR backfill semantics", () => {
    expect(migration).toContain("country_code = 'BE'");
    expect(migration).toContain("currency_code = 'EUR'");
    expect(migration).toContain("country_code is null");
    expect(migration).toContain("and currency_code is null");
  });
});
