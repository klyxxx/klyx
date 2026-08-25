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
const goldenLifecycle = read("scripts/golden-path-client-lifecycle.mjs");

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

  it("fails quote creation closed for active services that no longer satisfy qualification", () => {
    expect(quotePreflight).toContain("isUserServiceTransactionEligible");
    expect(quotePreflight).toContain('.eq("active", true)');
    expect(quotePreflight).toContain('.eq("provider_enabled", true)');
    expect(quotePreflight).toContain(
      'code: "KLYX_QUOTE_SKILL_QUALIFICATION_REQUIRED"'
    );
    expect(quotePreflight).toContain("{ status: 409 }");
  });

  it("revalidates live qualification before quote send or accept mutations", () => {
    expect(quoteRoute).toContain("quoteLifecycleQualificationPreflight");

    const lifecyclePreflightIndex = quoteRoute.indexOf(
      "const preflight = await quoteLifecycleQualificationPreflight("
    );
    const corePatchIndex = quoteRoute.indexOf("corePatch(request)");

    expect(lifecyclePreflightIndex).toBeGreaterThanOrEqual(0);
    expect(corePatchIndex).toBeGreaterThan(lifecyclePreflightIndex);

    expect(quotePreflight).toContain(
      'action !== "send" && action !== "accept"'
    );
    expect(quotePreflight).toContain(
      'profile.accountType !== "provider"'
    );
    expect(quotePreflight).toContain(
      'lifecycleQuote.status !== "requested"'
    );
    expect(quotePreflight).toContain(
      'profile.accountType !== "client"'
    );
    expect(quotePreflight).toContain(
      'lifecycleQuote.status !== "sent"'
    );
    expect(quotePreflight).toContain(
      "return qualificationRequiredResponse("
    );
  });

  it("preserves core price validation before send qualification revalidation", () => {
    expect(quotePreflight).toContain("Number(body.providerPrice)");
    expect(quotePreflight).toContain("!Number.isFinite(providerPrice)");
    expect(quotePreflight).toContain("providerPrice < 0");
    expect(quotePreflight).toContain("providerPrice > 1000000");
  });

  it("never blocks reject or cancel on qualification", () => {
    expect(quotePreflight).not.toContain('action === "reject"');
    expect(quotePreflight).not.toContain('action === "cancel"');
    expect(quotePreflight).toContain(
      'action !== "send" && action !== "accept"'
    );
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
    expect(goldenLifecycle).toContain('action: "send"');
    expect(goldenLifecycle).toContain('action: "accept"');
    expect(goldenLifecycle).toContain('path: "/api/bookings/create"');
  });
});
