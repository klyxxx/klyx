import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260920110000_klyx_economic_settlement_eligibility.sql"
);
const eligibility = read("lib/economic-settlement-eligibility-server.ts");
const single = read("lib/booking-settlement-server.ts");
const group = read("lib/platform-held-group-settlement-server.ts");
const stripeTruth = read("lib/stripe-settlement-recipient-truth.ts");
const documentation = read("docs/economic-settlement-eligibility.md");

describe("Mission 11 economic settlement eligibility contract", () => {
  it("creates one append-only decision ledger without creating parallel activity authorities", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_settlement_eligibility_decisions"
    );
    expect(migration).toContain(
      "klyx_economic_settlement_decisions_append_only"
    );
    expect(migration).not.toContain(
      "create table if not exists public.economic_capabilities"
    );
    expect(migration).not.toContain(
      "create table if not exists public.activity_qualifications"
    );
    expect(eligibility).toContain('"account_capability_qualifications"');
    expect(eligibility).toContain('"trust_eligibility_decisions"');
  });

  it("keeps the three-state authority closed and deterministic", () => {
    for (const decision of ["allowed", "human_review", "blocked"]) {
      expect(migration).toContain("'" + decision + "'");
    }
    expect(migration).toContain("decision_source = 'deterministic_rule'");
    expect(eligibility).not.toMatch(
      /openai|anthropic|generateText|languageModel/i
    );
  });

  it("never treats Stripe payouts_enabled as sufficient authorization", () => {
    expect(eligibility).toContain("stripeProjection.payouts_enabled");
    expect(eligibility).toContain("ACCOUNT_OFFER_SERVICES_CAPABILITY_DENIED");
    expect(eligibility).toContain("TRUST_ACTIVITY_ELIGIBILITY_MISSING");
    expect(eligibility).toContain("ECONOMIC_VERIFICATION_NOT_SATISFIED");
    expect(eligibility).toContain("ECONOMIC_RESTRICTION_ACTIVE");
    expect(documentation).toContain("payouts_enabled");
    expect(documentation).toContain("necessary evidence");
    expect(documentation).toContain("never sufficient");
  });

  it("requires a fresh economic allow before the independent risk allow in both SQL claims", () => {
    const singleEconomic = migration.indexOf(
      "from public.economic_settlement_eligibility_decisions as d"
    );
    const singleRisk = migration.indexOf(
      "from public.transaction_risk_decisions as d"
    );
    expect(singleEconomic).toBeGreaterThan(-1);
    expect(singleRisk).toBeGreaterThan(singleEconomic);

    const groupStart = migration.indexOf(
      "klyx_claim_platform_held_group_member_release"
    );
    const groupEconomic = migration.indexOf(
      "from public.economic_settlement_eligibility_decisions as d",
      groupStart
    );
    const groupRisk = migration.indexOf(
      "from public.transaction_risk_decisions d",
      groupStart
    );
    expect(groupEconomic).toBeGreaterThan(groupStart);
    expect(groupRisk).toBeGreaterThan(groupEconomic);
    expect(migration).toContain("d.expires_at > now()");
    expect(migration).toContain(
      "d.evaluated_at >= now() - interval '5 minutes'"
    );
  });

  it("evaluates every booking in a group member instead of collapsing mixed activity contexts", () => {
    expect(group).toContain("memberBookingIds(member).map((bookingId)");
    expect(group).toContain("canReceiveSettlementForBooking");
    expect(migration).toContain(
      "from jsonb_array_elements_text(v_member.booking_ids) as booking_id"
    );
  });

  it("reconciles an already-created single Transfer without requiring authorization for a new money movement", () => {
    const reconciliation = single.indexOf("reconcileReleaseFromStripeTruth");
    const eligibilityGate = single.indexOf(
      "const economicEligibility = await canReceiveSettlementForBooking"
    );
    expect(reconciliation).toBeGreaterThan(-1);
    expect(eligibilityGate).toBeGreaterThan(reconciliation);
    expect(migration).toContain(
      "create or replace function public.klyx_reconcile_booking_settlement_release"
    );
    expect(documentation).toContain("already-existing Stripe Transfer");
  });

  it("revalidates economic authority and remote Stripe truth after the atomic claim before a new Transfer", () => {
    const singleClaim = single.indexOf(
      '"klyx_claim_booking_settlement_release"'
    );
    const singleRevalidation = single.indexOf(
      "const revalidatedEligibility = await canReceiveSettlementForBooking"
    );
    const singleStripeTruth = single.indexOf(
      "readStripeSettlementRecipientTruth",
      singleRevalidation
    );
    const singleTransfer = single.indexOf(
      "stripe.transfers.create",
      singleStripeTruth
    );
    expect(singleRevalidation).toBeGreaterThan(singleClaim);
    expect(singleStripeTruth).toBeGreaterThan(singleRevalidation);
    expect(singleTransfer).toBeGreaterThan(singleStripeTruth);

    const groupClaim = group.indexOf(
      '"klyx_claim_platform_held_group_member_release"'
    );
    const groupRevalidation = group.indexOf(
      "const revalidatedEconomicEligibility"
    );
    const groupStripeTruth = group.indexOf(
      "readStripeSettlementRecipientTruth",
      groupRevalidation
    );
    const groupTransfer = group.indexOf(
      "stripe.transfers.create",
      groupStripeTruth
    );
    expect(groupRevalidation).toBeGreaterThan(groupClaim);
    expect(groupStripeTruth).toBeGreaterThan(groupRevalidation);
    expect(groupTransfer).toBeGreaterThan(groupStripeTruth);
  });

  it("keeps Economic Eligibility mandatory when LIVE becomes explicitly authorizable", () => {
    expect(single).toContain("assertFinancialStripeWriteAuthorized");
    expect(group).toContain("assertFinancialStripeWriteAuthorized");
    expect(single).toContain("canReceiveSettlementForBooking");
    expect(group).toContain("canReceiveSettlementForBooking");
    expect(stripeTruth).not.toContain("transfers.create");
    expect(migration).not.toContain("refunds.create");
    expect(migration).not.toContain("reversals.create");
    expect(migration).not.toContain("sk_live_");
  });
});
