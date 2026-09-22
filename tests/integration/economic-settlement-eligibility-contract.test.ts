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
const networkProof = read(
  "scripts/golden-path-economic-chain-stripe-blocked.mjs"
);

const runtimeSourceRoots = ["app", "lib", "hooks", "payload", "supabase"] as const;
const runtimeTopLevelSources = ["instrumentation.ts", "proxy.ts", "next.config.ts"] as const;
const runtimeSourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function runtimeSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path
      .relative(root, absolutePath)
      .split(path.sep)
      .join("/");

    if (entry.isDirectory()) {
      return runtimeSourceFiles(relativePath);
    }

    if (!entry.isFile() || !runtimeSourceExtensions.has(path.extname(entry.name))) {
      return [];
    }

    return [relativePath];
  });
}

function directStripeTransferWriters(): string[] {
  const transferMutation = /\.transfers\s*\.\s*create\s*\(/;

  return [
    ...runtimeSourceRoots.flatMap((sourceRoot) => runtimeSourceFiles(sourceRoot)),
    ...runtimeTopLevelSources.filter((file) => fs.existsSync(path.join(root, file))),
  ]
    .filter((file) => transferMutation.test(read(file)))
    .sort();
}

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

  it("requires a verified primary legal subject and explicit KYC/KYB evidence before settlement", () => {
    expect(eligibility).toContain('"economic_legal_entities"');
    expect(eligibility).toContain('"economic_persons"');
    expect(eligibility).toContain("ECONOMIC_LEGAL_SUBJECT_MISSING");
    expect(eligibility).toContain("ECONOMIC_LEGAL_SUBJECT_NOT_VERIFIED");
    expect(eligibility).toContain("ECONOMIC_LEGAL_SUBJECT_EXPIRED");
    expect(eligibility).toContain("ECONOMIC_LEGAL_SUBJECT_RESTRICTED");
    expect(eligibility).toContain("ECONOMIC_VERIFICATION_MISSING");
  });

  it("blocks a required missing qualification and jurisdiction restriction before settlement", () => {
    expect(eligibility).toContain("ACCOUNT_QUALIFICATION_MISSING");
    expect(eligibility).toContain("trustDecisionRequiresQualification");
    expect(eligibility).toContain("ECONOMIC_COUNTRY_RESTRICTED");
  });

  it("uses Accounts v2 recipient transfer capability instead of legacy payout booleans", () => {
    expect(eligibility).toContain("payouts_enabled: boolean;");
    expect(eligibility).not.toContain('blocked.push("STRIPE_PAYOUTS_NOT_ENABLED")');
    expect(eligibility).not.toContain('blocked.push("STRIPE_DETAILS_NOT_SUBMITTED")');
    expect(eligibility).toContain("STRIPE_TRANSFER_CAPABILITY_INACTIVE");
    expect(eligibility).toContain("transferCapabilityActive");
    expect(eligibility).toContain("ACCOUNT_OFFER_SERVICES_CAPABILITY_DENIED");
    expect(eligibility).toContain("TRUST_ACTIVITY_ELIGIBILITY_MISSING");
    expect(eligibility).toContain("ECONOMIC_VERIFICATION_NOT_SATISFIED");
    expect(eligibility).toContain("ECONOMIC_RESTRICTION_ACTIVE");
    expect(documentation).toContain("legacy compatibility evidence");
    expect(documentation).toContain("stripe_transfers");
  });

  it("proves Stripe Recipient green / KLYX blocked without relying on legacy payout flags", () => {
    expect(networkProof).toContain("v2RecipientTransferReady(v2Account)");
    expect(networkProof).toContain(
      'stripeTransferStatus: v2TransferStatus(v2Account)'
    );
    expect(networkProof).toContain(
      'code.startsWith("STRIPE_")'
    );
    expect(networkProof).toContain(
      "STRIPE_OK_KLYX_BLOCKED_PREVENTS_BENEFICIARY_TRANSFER"
    );
    expect(networkProof).toContain("insertSettlementRiskAllow");
    expect(networkProof).toContain('action: "settlement_release"');
    expect(networkProof).toContain('decision: "allow"');
    expect(networkProof).not.toContain(
      'stripeAccount.payouts_enabled === true'
    );
    expect(networkProof).not.toContain(
      'stripeAccount.details_submitted === true'
    );
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

  it("forbids any production Stripe Transfer writer outside the economic eligibility authority boundary", () => {
    const writers = directStripeTransferWriters();

    expect(writers).toEqual([
      "lib/booking-settlement-server.ts",
      "lib/platform-held-group-settlement-server.ts",
    ]);

    for (const writer of writers) {
      const source = read(writer);

      expect(source).toContain("canReceiveSettlementForBooking");
      expect(source).toContain("readStripeSettlementRecipientTruth");
      expect(source).toContain("economic_settlement_eligibility_changed");
    }
  });

  it("keeps economic eligibility independent from the controlled LIVE runtime", () => {
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(single).toContain("requireKlyxFinancialStripeRuntimeForBooking");
    expect(group).toContain("requireKlyxFinancialStripeRuntime");
    expect(runtime).toContain("KLYX_LIVE_CERTIFICATION_PROFILE_ID");
    expect(runtime).toContain("KLYX_LIVE_CERTIFICATION_SHA");
    expect(runtime).toContain("KLYX_DR_CERTIFIED_SHA");
    expect(stripeTruth).not.toContain("transfers.create");
    expect(migration).not.toContain("refunds.create");
    expect(migration).not.toContain("reversals.create");
    expect(migration).not.toContain("sk_live_");
  });
});
