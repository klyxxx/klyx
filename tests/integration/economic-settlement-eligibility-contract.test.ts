import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260920110000_klyx_economic_settlement_eligibility.sql"
);
const server = read("lib/economic-settlement-eligibility-server.ts");
const adapter = read("lib/economic-settlement-eligibility-adapter.ts");
const engine = read("lib/economic-eligibility-engine.ts");
const authority = `${server}\n${adapter}\n${engine}`;
const single = read("lib/booking-settlement-server.ts");
const group = read("lib/platform-held-group-settlement-server.ts");
const stripeTruth = read("lib/stripe-settlement-recipient-truth.ts");
const beneficiaryTransferGateway = read("lib/beneficiary-transfer-gateway.ts");
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

    if (entry.isDirectory()) return runtimeSourceFiles(relativePath);
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
  it("keeps one append-only decision ledger and existing canonical authorities", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_settlement_eligibility_decisions"
    );
    expect(migration).toContain("klyx_economic_settlement_decisions_append_only");
    expect(migration).not.toContain(
      "create table if not exists public.economic_capabilities"
    );
    expect(migration).not.toContain(
      "create table if not exists public.activity_qualifications"
    );
    expect(server).toContain('"account_capability_qualifications"');
    expect(server).toContain('"trust_eligibility_decisions"');
  });

  it("cuts decision authority over to the pure engine", () => {
    expect(server).toContain("evaluateSettlementEligibilitySnapshot");
    expect(adapter).toContain("evaluateEconomicEligibility");
    expect(server).not.toContain("blocked.push(");
    expect(server).not.toContain("review.push(");
    expect(engine).not.toMatch(/supabase|stripe|openai|anthropic/i);
    expect(adapter).not.toMatch(/supabaseAdmin|stripe\.transfers\.create/i);
  });

  it("keeps deterministic allowed / human_review / blocked decisions", () => {
    for (const decision of ["allowed", "human_review", "blocked"]) {
      expect(migration).toContain("'" + decision + "'");
    }
    expect(migration).toContain("decision_source = 'deterministic_rule'");
    expect(authority).not.toMatch(/openai|anthropic|generateText|languageModel/i);
  });

  it("records engine evidence, audit event, previous state and new state", () => {
    expect(adapter).toContain("previousEconomicEligibilityState");
    expect(adapter).toContain("engineAuditEvent");
    expect(adapter).toContain("engineState");
    expect(engine).toContain("previousState: input.previous ?? null");
    expect(engine).toContain("newState: { state, decision, authorized }");
    expect(server).toContain("evidence_snapshot: input.evidenceSnapshot");
  });

  it("requires legal identity, verification, qualifications and country eligibility", () => {
    expect(server).toContain('"economic_legal_entities"');
    expect(server).toContain('"economic_persons"');
    expect(server).toContain('"economic_verification_cases"');
    expect(adapter).toContain("ECONOMIC_LEGAL_SUBJECT_MISSING");
    expect(adapter).toContain("ECONOMIC_LEGAL_SUBJECT_NOT_VERIFIED");
    expect(adapter).toContain("ECONOMIC_LEGAL_SUBJECT_EXPIRED");
    expect(adapter).toContain("ECONOMIC_LEGAL_SUBJECT_RESTRICTED");
    expect(adapter).toContain("ECONOMIC_VERIFICATION_MISSING");
    expect(adapter).toContain("ACCOUNT_QUALIFICATION_MISSING");
    expect(adapter).toContain("trustDecisionRequiresQualification");
    expect(adapter).toContain("ECONOMIC_COUNTRY_RESTRICTED");
  });

  it("treats Stripe as external provider state, not KLYX authorization authority", () => {
    expect(server).toContain("payouts_enabled: boolean;");
    expect(adapter).toContain("externalPaymentProvider");
    expect(adapter).toContain("transferActive");
    expect(adapter).toContain("STRIPE_TRANSFER_CAPABILITY_INACTIVE");
    expect(adapter).toContain("ACCOUNT_OFFER_SERVICES_CAPABILITY_DENIED");
    expect(adapter).toContain("TRUST_ACTIVITY_ELIGIBILITY_MISSING");
    expect(adapter).toContain("ECONOMIC_VERIFICATION_NOT_SATISFIED");
    expect(adapter).toContain("ECONOMIC_RESTRICTION_ACTIVE");
    expect(documentation).toContain("legacy compatibility evidence");
    expect(documentation).toContain("stripe_transfers");
  });

  it("proves provider green / KLYX blocked prevents beneficiary movement", () => {
    expect(networkProof).toContain("v2RecipientTransferReady(v2Account)");
    expect(networkProof).toContain('stripeTransferStatus: v2TransferStatus(v2Account)');
    expect(networkProof).toContain('code.startsWith("STRIPE_")');
    expect(networkProof).toContain(
      "STRIPE_OK_KLYX_BLOCKED_PREVENTS_BENEFICIARY_TRANSFER"
    );
    expect(networkProof).toContain("insertSettlementRiskAllow");
    expect(networkProof).not.toContain('stripeAccount.payouts_enabled === true');
    expect(networkProof).not.toContain('stripeAccount.details_submitted === true');
  });

  it("requires a fresh economic allow before the independent risk allow", () => {
    const singleEconomic = migration.indexOf(
      "from public.economic_settlement_eligibility_decisions as d"
    );
    const singleRisk = migration.indexOf("from public.transaction_risk_decisions as d");
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
    expect(migration).toContain("d.evaluated_at >= now() - interval '5 minutes'");
  });

  it("evaluates each booking independently for group settlement", () => {
    expect(group).toContain("memberBookingIds(member).map((bookingId)");
    expect(group).toContain("canReceiveSettlementForBooking");
    expect(migration).toContain(
      "from jsonb_array_elements_text(v_member.booking_ids) as booking_id"
    );
  });

  it("keeps recovery of an existing Transfer separate from new movement authorization", () => {
    const reconciliation = single.indexOf("reconcileReleaseFromStripeTruth");
    const eligibilityGate = single.indexOf(
      "const economicEligibility = await canReceiveSettlementForBooking"
    );
    expect(reconciliation).toBeGreaterThan(-1);
    expect(eligibilityGate).toBeGreaterThan(reconciliation);
    expect(documentation).toContain("already-existing Stripe Transfer");
  });

  it("routes every new beneficiary Transfer through the canonical gateway", () => {
    const gatewayEconomic = beneficiaryTransferGateway.indexOf(
      "canReceiveSettlementForBooking"
    );
    const gatewayStripeTruth = beneficiaryTransferGateway.indexOf(
      "readStripeSettlementRecipientTruth",
      gatewayEconomic
    );
    const gatewayTransfer = beneficiaryTransferGateway.indexOf(
      "stripe.transfers.create",
      gatewayStripeTruth
    );
    expect(gatewayEconomic).toBeGreaterThan(-1);
    expect(gatewayStripeTruth).toBeGreaterThan(gatewayEconomic);
    expect(gatewayTransfer).toBeGreaterThan(gatewayStripeTruth);
    expect(single).not.toContain("stripe.transfers.create(");
    expect(group).not.toContain("stripe.transfers.create(");
  });

  it("forbids any production Stripe Transfer writer outside the beneficiary gateway", () => {
    expect(directStripeTransferWriters()).toEqual([
      "lib/beneficiary-transfer-gateway.ts",
    ]);
    expect(beneficiaryTransferGateway).toContain("BeneficiaryTransferAuthorizationError");
    expect(beneficiaryTransferGateway).toContain("onStripeWriteAttempt");
  });

  it("keeps economic eligibility independent from LIVE runtime activation", () => {
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
