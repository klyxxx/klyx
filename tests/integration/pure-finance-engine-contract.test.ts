import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const moduleDir = path.join(root, "lib/pure-finance");
const moduleFiles = fs
  .readdirSync(moduleDir)
  .filter((name) => name.endsWith(".ts"))
  .sort();
const source = [
  fs.readFileSync(path.join(root, "lib/pure-finance-engine.ts"), "utf8"),
  ...moduleFiles.map((name) =>
    fs.readFileSync(path.join(moduleDir, name), "utf8")
  ),
].join("\n");

describe("KLYX pure finance architecture contract", () => {
  it("has no payment-provider, database or server-only dependency", () => {
    expect(source).not.toMatch(/from\s+["'][^"']*stripe/i);
    expect(source).not.toMatch(/from\s+["'][^"']*supabase/i);
    expect(source).not.toContain('import "server-only"');
    expect(source).not.toContain("supabaseAdmin");
    expect(source).not.toContain("stripe.");
  });

  it("does not depend on clocks, randomness, locale metadata or network I/O", () => {
    for (const forbidden of [
      "Date.now",
      "new Date(",
      "Math.random",
      "randomUUID",
      "fetch(",
      "Intl.NumberFormat",
      "localeCompare",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps the canonical financial vocabulary", () => {
    for (const token of [
      '"charge"',
      '"commission"',
      '"provider_liability"',
      '"transfer"',
      '"reversal"',
      '"refund"',
      'type: "payout"',
    ]) {
      expect(source).toContain(token);
    }
  });

  it("injects currency and FX truth instead of hardcoding a permanent currency set", () => {
    expect(source).toContain("export type CurrencyCatalog");
    expect(source).toContain("KLYX_FINANCE_CURRENCY_POLICY_MISSING");
    expect(source).toContain("KLYX_FINANCE_FX_RATE_REQUIRED");
    expect(source).not.toMatch(/const\s+(SUPPORTED|ALLOWED)_CURRENC/i);
  });

  it("uses integer/rational math and deterministic operation identities", () => {
    expect(source).toContain('export type FinanceRoundingMode = "half_up"');
    expect(source).toContain("BigInt(");
    expect(source).toContain("allocateProportionally");
    expect(source).toContain("KLYX_FINANCE_OPERATION_DUPLICATE");
  });
});
