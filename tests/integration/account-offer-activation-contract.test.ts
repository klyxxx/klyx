import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const capabilities = read("app/api/account/capabilities/route.ts");
const offerRoute = read("app/api/account/offer-readiness/route.ts");
const assistant = read("app/api/assistant/respond/route.ts");
const readiness = read("lib/account-offer-readiness-server.ts");
const nextConfig = read("next.config.ts");

describe("account-first offer-services activation", () => {
  it("forbids a raw user toggle from enabling offer_services", () => {
    expect(capabilities).toContain("KLYX_OFFER_SERVICES_READINESS_REQUIRED");
    expect(capabilities).toContain("body.offerServices === true");
    expect(capabilities).not.toContain("ensureLegacyOfferCompatibilityProfile");
  });

  it("activates only through server-side readiness re-evaluation", () => {
    expect(offerRoute).toContain("activateAccountOfferServices");
    expect(readiness).toContain("const firstReadiness = await loadAccountOfferReadiness");
    expect(readiness).toContain("const readiness = await loadAccountOfferReadiness");
    expect(readiness).toContain("{ offer_services: true }");
    expect(readiness).toContain('{ source: "system" }');
  });

  it("keeps canonical account identity authoritative and legacy profiles as storage adapters", () => {
    expect(readiness).toContain('.eq("account_id", accountId)');
    expect(readiness).toContain("ensureLegacyOfferCompatibilityProfile(input.accountId)");
    expect(assistant).toContain("accountId: auth.account.id");
    expect(assistant).not.toContain("switchAccount");
    expect(readiness).not.toContain("switchAccount");
  });

  it("reuses historical Stripe state and never creates a Connected Account", () => {
    expect(readiness).toContain("stripe_account_id");
    expect(readiness).toContain("stripe_onboarding_complete");
    expect(readiness).toContain("stripe_payouts_enabled");
    expect(readiness).toContain("stripeAccountIds.size > 1");
    expect(readiness).not.toContain("stripe.accounts.create");
    expect(assistant).not.toContain("stripe.accounts.create");
  });

  it("fails closed through the existing account-first Trust & Safety decision ledger", () => {
    expect(readiness).toContain("listTrustDecisions");
    expect(readiness).toContain('targetType: "category"');
    expect(readiness).toContain("TRUST_DECISION_REQUIRED");
    expect(readiness).toContain('accessDecision: "human_review"');
    expect(readiness).not.toContain("profiles.account_type ===");
  });

  it("keeps bank details out of chat and does not invent price, radius or hours", () => {
    expect(assistant).toContain("mergeOfferPricingDraft");
    expect(assistant).toContain("parseOfferRadiusKm");
    expect(assistant).toContain("parseOfferAvailability");
    expect(readiness).not.toContain('pricing_type: input.pricing?.pricingType ?? "hourly"');
    expect(readiness).not.toContain("travel_radius_km: input.radiusKm ?? 0");
  });

  it("keeps the public Brain URL while dispatching offer intent to the unified assistant", () => {
    expect(nextConfig).toContain('source: "/api/brain/respond"');
    expect(nextConfig).toContain('destination: "/api/assistant/respond"');
    expect(assistant).toContain("detectOfferServicesIntent");
    expect(assistant).toContain("brainRespondPost(request)");
  });

  it("reuses the already merged provider income orchestration and preserves confirmation", () => {
    expect(assistant).toContain("buildProviderIncomeOrchestration");
    expect(assistant).toContain("parseProviderIncomeGoal");
    expect(assistant).toContain("Rien n’est accepté automatiquement");
    expect(assistant).not.toContain("automaticAcceptance: true");
  });
});
