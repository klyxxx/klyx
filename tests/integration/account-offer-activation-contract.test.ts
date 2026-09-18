import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const capabilities = read("app/api/account/capabilities/route.ts");
const offerRoute = read("app/api/account/offer-readiness/route.ts");
const assistant = read("app/api/assistant/respond/route.ts");
const converse = read("app/api/brain/converse/route.ts");
const readiness = read("lib/account-offer-readiness-server.ts");
const legalServer = read("lib/account-offer-legal-server.ts");
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
    expect(assistant).toContain("accountProfileIds(accountId)");
    expect(assistant).toContain("profileIds.includes(conversation.user_id)");
    expect(assistant).not.toContain("switchAccount");
    expect(readiness).not.toContain("switchAccount");
  });

  it("starts offer onboarding independently from legacy client/provider role authority", () => {
    expect(assistant).toContain("getAuthenticatedAccount(request)");
    expect(assistant).not.toContain('requireAccountType(auth.profile, "client")');
    expect(assistant).not.toContain('requireAccountType(auth.profile, "provider")');
  });

  it("uses canonical Stripe state, fails closed on identity review, and never creates a Connected Account", () => {
    expect(readiness).toContain("getAccountStripeConnectIdentity");
    expect(readiness).toContain('identity.state === "linked"');
    expect(readiness).toContain('identity.state === "conflict"');
    expect(readiness).toContain("payoutReviewRequired");
    expect(readiness).not.toContain("stripe_account_id");
    expect(readiness).toContain("compatibilityStatusReady");
    expect(readiness).not.toContain("stripe.accounts.create");
    expect(assistant).not.toContain("stripe.accounts.create");
  });

  it("maps a service to the canonical KLYX policy category and fails closed when unmapped", () => {
    expect(readiness).toContain("KLYX_SERVICE_CATALOG");
    expect(readiness).toContain("serviceCategoryKey(selected.service)");
    expect(readiness).toContain("CATEGORY_MAPPING_REQUIRED");
    expect(readiness).toContain("BE-BRU");
    expect(readiness).toContain("BE-WAL");
    expect(readiness).toContain("BE-VLG");
  });

  it("stores legal declarations only in the account-first work-context ledger", () => {
    expect(assistant).toContain("mergeOfferLegalDraft");
    expect(assistant).toContain("recordAccountOfferLegalDeclaration");
    expect(legalServer).toContain('.from("trust_work_contexts")');
    expect(legalServer).toContain("declared_pathway_intent");
    expect(legalServer).toContain("declared_activity_frequency");
    expect(legalServer).toContain("legal_uncertain");
    expect(legalServer).not.toContain("provider_legal_profiles");
    expect(assistant).not.toContain("provider_legal_profiles");
  });

  it("treats legal declarations as facts and never auto-classifies a legal pathway", () => {
    expect(assistant).toContain("Tes déclarations sont enregistrées comme des faits, pas comme un statut juridique");
    expect(assistant).toContain("Je ne vais pas le deviner");
    expect(legalServer).not.toContain("occasional_compatible");
    expect(legalServer).not.toContain("independent_compatible");
    expect(legalServer).not.toContain("employment_structure_required");
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

  it("enables only the ready service adapter and does not auto-publish the provider profile", () => {
    expect(readiness).toContain("enableReadyServiceAdapter(readiness)");
    expect(readiness).toContain("active: true, provider_enabled: true");
    expect(readiness).toContain("available: true");
    expect(readiness).not.toContain("is_published: true");
  });

  it("keeps the public Brain URLs while dispatching the main conversation through the unified assistant", () => {
    expect(nextConfig).toContain('source: "/api/brain/respond"');
    expect(nextConfig).toContain('destination: "/api/assistant/respond"');
    expect(converse).toContain('from "../../assistant/respond/route"');
    expect(converse).toContain('payload.intentMode === "offer_services"');
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
