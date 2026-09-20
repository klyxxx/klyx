import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260920080000_klyx_global_money_market_policy.sql"
  ),
  "utf8"
);
const marketCatalogue = fs.readFileSync(
  path.join(root, "lib/klyx-supported-markets.ts"),
  "utf8"
);
const money = fs.readFileSync(path.join(root, "lib/klyx-money.ts"), "utf8");

describe("KLYX global money market policy contract", () => {
  it("keeps market, currency capability and FX truth server-side", () => {
    expect(migration).toContain("public.klyx_market_payment_rules");
    expect(migration).toContain("public.klyx_payment_currency_capabilities");
    expect(migration).toContain("public.klyx_fx_quotes");
    expect(migration).toContain("revoke all privileges");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("separates payer country from execution country", () => {
    expect(migration).toContain("payer_country_code");
    expect(migration).toContain("execution_country_code");
    expect(migration).toContain("cross_border_allowed");
  });

  it("stores commission, tax and availability as data", () => {
    expect(migration).toContain("commission_bps");
    expect(migration).toContain("tax_mode");
    expect(migration).toContain("tax_rate_bps");
    expect(migration).toContain("availability_status");
  });

  it("does not treat the legacy country catalogue as product authority", () => {
    expect(marketCatalogue).toContain(
      "KLYX_LEGACY_MARKET_CATALOG_IS_AUTHORITY = false"
    );
    expect(money).not.toContain(
      'throw new Error(\n      "KLYX_MARKET_NOT_SUPPORTED"'
    );
  });

  it("does not seed a permanent product country allow-list", () => {
    expect(migration).not.toMatch(
      /insert\s+into\s+public\.klyx_market_payment_rules/i
    );
  });
});
