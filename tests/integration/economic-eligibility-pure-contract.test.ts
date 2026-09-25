import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const enginePath = path.join(
  process.cwd(),
  "lib/economic-eligibility-engine.ts"
);
const source = fs.readFileSync(enginePath, "utf8");

describe("KLYX pure economic eligibility dependency contract", () => {
  it("has no Supabase dependency", () => {
    expect(source).not.toMatch(/from\s+["'][^"']*supabase/i);
    expect(source).not.toMatch(/supabaseAdmin|createClient\(/);
  });

  it("has no Stripe SDK dependency", () => {
    expect(source).not.toMatch(/from\s+["']stripe["']/i);
    expect(source).not.toMatch(/new\s+Stripe\s*\(/);
  });

  it("contains every required canonical eligibility state", () => {
    for (const state of [
      "verified",
      "pending",
      "expired",
      "restricted",
      "qualification_missing",
      "country_restricted",
      "payouts_disabled",
      "requirements_due",
      "human_review",
    ]) {
      expect(source).toContain(`\"${state}\"`);
    }
  });

  it("keeps settlement authorization explicit", () => {
    expect(source).toContain("settlementIsAuthorized");
    expect(source).toContain("EXTERNAL_SETTLEMENT_DISABLED");
    expect(source).toContain("ALL_KLYX_AUTHORITIES_VERIFIED");
  });
});
