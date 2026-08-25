import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const publication = read("lib/provider-skill-publication.ts");
const bookingCreate = read("app/api/bookings/create/route.ts");
const quoteRoute = read("app/api/quotes/route.ts");
const quotePreflight = read(
  "lib/quote-transaction-qualification-preflight.ts"
);
const goldenFixture = read("scripts/golden-path-provider-fixture.mjs");

describe("transaction live skill eligibility contract", () => {
  it("separates transaction eligibility from literal KLYX approval", () => {
    expect(publication).toContain(
      "export async function isUserServiceTransactionEligible"
    );
    expect(publication).toContain(
      "qualification.eligibleUserServiceIds.has(userServiceId)"
    );
    expect(publication).toContain(
      "export async function isUserServiceKlyxApproved"
    );
    expect(publication).toContain('.eq("status", "approved")');
  });

  it("keeps the historical booking helper as a live-eligibility compatibility alias", () => {
    expect(publication).toContain(
      "export async function isUserServiceApproved"
    );
    expect(publication).toContain(
      "return isUserServiceTransactionEligible(params);"
    );
    expect(bookingCreate).toContain("isUserServiceApproved");
  });

  it("gates quote creation on live eligibility before the core can mutate", () => {
    expect(quoteRoute).toContain("quoteTransactionQualificationPreflight");
    expect(quoteRoute).toContain("request.clone()");

    const preflightIndex = quoteRoute.indexOf(
      "const preflight = await quoteTransactionQualificationPreflight("
    );
    const corePostIndex = quoteRoute.indexOf("corePost(request)");

    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(corePostIndex).toBeGreaterThan(preflightIndex);
    expect(quoteRoute).toContain("if (preflight) return preflight;");
  });

  it("fails quote eligibility closed for active services that no longer satisfy qualification", () => {
    expect(quotePreflight).toContain("isUserServiceTransactionEligible");
    expect(quotePreflight).toContain('.eq("active", true)');
    expect(quotePreflight).toContain('.eq("provider_enabled", true)');
    expect(quotePreflight).toContain(
      'code: "KLYX_QUOTE_SKILL_QUALIFICATION_REQUIRED"'
    );
    expect(quotePreflight).toContain("{ status: 409 }");
  });

  it("proves the golden self-declared flow without an artificial approved verification", () => {
    expect(goldenFixture).toContain(
      '.from("provider_skill_verifications")'
    );
    expect(goldenFixture).toContain(".delete()\n");
    expect(goldenFixture).not.toContain('status: "approved"');
    expect(goldenFixture).not.toContain(
      "Golden-path fixture approved only inside the ephemeral local Supabase runner."
    );
  });
});
