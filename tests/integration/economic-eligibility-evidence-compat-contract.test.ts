import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260924214000_klyx_economic_eligibility_evidence_compat.sql"
  ),
  "utf8"
);

describe("economic eligibility evidence compatibility", () => {
  it("copies provider-neutral transfer evidence into historical audit aliases", () => {
    expect(migration).toContain("externalTransferCapabilityStatus");
    expect(migration).toContain("stripeTransferCapabilityStatus");
    expect(migration).toContain("externalTransferCapabilityActive");
    expect(migration).toContain("stripeTransferCapabilityActive");
  });

  it("runs only before insert on the append-only decision ledger", () => {
    expect(migration).toContain(
      "before insert on public.economic_settlement_eligibility_decisions"
    );
    expect(migration).not.toMatch(/\bupdate\s+public\.economic_settlement_eligibility_decisions\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.economic_settlement_eligibility_decisions\b/i);
  });

  it("does not recalculate allowed, blocked or human_review decisions", () => {
    expect(migration).not.toMatch(/new\.decision\s*:=/i);
    expect(migration).not.toMatch(/new\.reason_codes\s*:=/i);
    expect(migration).not.toMatch(/stripe_transfer|payouts_enabled|qualification|country_restricted/i);
  });
});
