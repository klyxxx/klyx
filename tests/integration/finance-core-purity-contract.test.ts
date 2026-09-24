import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "lib/finance-core.ts"), "utf8");

describe("KLYX pure financial engine architecture contract", () => {
  it("has no payment-provider, database or server-runtime dependency", () => {
    expect(source).not.toMatch(/from\s+["'][^"']*stripe/i);
    expect(source).not.toMatch(/from\s+["'][^"']*supabase/i);
    expect(source).not.toContain('import "server-only"');
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toContain("stripe.");
  });

  it("does not depend on clocks, randomness, locale currency metadata or network I/O", () => {
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("randomUUID");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("Intl.NumberFormat");
    expect(source).not.toContain("localeCompare");
  });

  it("keeps the canonical financial vocabulary in the pure core", () => {
    for (const movement of [
      '"charge"',
      '"commission"',
      '"provider_liability"',
      '"transfer"',
      '"reversal"',
      '"refund"',
      'type: "payout"',
    ]) {
      expect(source).toContain(movement);
    }
  });

  it("requires external currency policies and an explicit FX rate instead of permanent built-in market limits", () => {
    expect(source).toContain("export type CurrencyCatalog");
    expect(source).toContain("KLYX_FINANCE_CURRENCY_POLICY_MISSING");
    expect(source).toContain("KLYX_FINANCE_FX_RATE_REQUIRED");
    expect(source).not.toMatch(/const\s+(SUPPORTED|ALLOWED)_CURRENC/i);
  });

  it("locks deterministic operation identity and canonical integer rounding", () => {
    expect(source).toContain("KLYX_FINANCE_OPERATION_DUPLICATE");
    expect(source).toContain('export type FinanceRoundingMode = "half_up"');
    expect(source).toContain("BigInt");
    expect(source).toContain("allocateProportionally");
  });
});
