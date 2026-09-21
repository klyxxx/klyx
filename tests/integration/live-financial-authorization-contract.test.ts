import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260921173000_klyx_live_financial_authorization.sql"
);
const gate = read("lib/live-financial-authorization-server.ts");
const stripeInfra = read("lib/stripe-live-infrastructure-server.ts");
const stripeRuntime = read("lib/financial-stripe-runtime.ts");
const identity = read("lib/stripe-connect-account-identity.ts");
const connect = read("lib/stripe-connect-account.ts");
const settlementControl = read("lib/stripe-settlement-control.ts");
const singleCheckout = read(
  "app/api/stripe/create-checkout-session/route-platform-held-core.ts"
);
const groupCheckout = read(
  "app/api/bookings/split-missions/[id]/checkout/route-platform-held-core.ts"
);
const singleSettlement = read("lib/booking-settlement-server.ts");
const groupSettlement = read("lib/platform-held-group-settlement-server.ts");
const paymentWebhook = read("app/api/stripe/webhook/route.ts");
const founderControl = read(
  "app/api/founder/live-financial-authorization/route.ts"
);
const financialSentinel = read(
  ".github/workflows/klyx-financial-operations-sentinel.yml"
);
const deployment = read("scripts/operations/deploy-production-manual.ps1");
const nextConfig = read("next.config.ts");
const health = read("app/api/health/route.ts");

describe("KLYX LIVE financial authorization contract", () => {
  it("models LIVE as explicit, versioned, reversible and immutable-audited state", () => {
    expect(migration).toContain(
      "create table if not exists public.financial_live_authorizations"
    );
    expect(migration).toContain("check (state in ('disarmed', 'armed'))");
    expect(migration).toContain(
      "create table if not exists public.financial_live_authorization_events"
    );
    expect(migration).toContain(
      "financial_live_authorization_events_immutable"
    );
    expect(migration).toContain(
      "klyx_set_financial_live_authorization"
    );
    expect(migration).toContain("p_expected_version");
    expect(migration).toContain("'INITIAL_DISARMED'");
    expect(founderControl).toContain('["arm", "disarm"]');
    expect(founderControl).toContain("expectedVersion");
    expect(founderControl).toContain("candidateCertifiedSha");
    expect(founderControl).toContain(
      "Le SHA certifié doit être exactement le SHA immuable du build déployé."
    );
  });

  it("requires exact deployed build SHA equality before any LIVE authorization", () => {
    expect(nextConfig).toContain("KLYX_RELEASE_SHA");
    expect(nextConfig).toContain("KLYX_BUILD_RELEASE_SHA");
    expect(nextConfig).toContain("^[0-9a-f]{40}$");
    expect(health).toContain("getKlyxBuildReleaseSha");
    expect(deployment).toContain("$env:KLYX_RELEASE_SHA = $sha");
    expect(deployment).toContain("health.releaseSha");
    expect(deployment).toContain("Release SHA mismatch");
    expect(gate).toContain("certified_sha_matches_build");
    expect(gate).toContain("buildReleaseSha === certifiedSha");
  });

  it("requires operational breakers, canonical authorities and fresh live proofs", () => {
    for (const capability of [
      '"payments"',
      '"settlement_release"',
      '"refunds"',
    ]) {
      expect(gate).toContain(capability);
    }
    expect(gate).toContain("getKlyxOpsCapabilityDecision");
    expect(gate).toContain("financial_ledger_events");
    expect(gate).toContain("economic_settlement_eligibility_decisions");
    expect(gate).toContain("financial_reconciliation_current");
    expect(gate).toContain("ops_durable_job_dlq");
    expect(gate).toContain("critical_monitoring");
    expect(gate).toContain("proof_durable_jobs_worker");
    expect(gate).toContain("proof_critical_alerting");
    expect(gate).toContain("proof_settlement_reconciliation");
  });

  it("activates queue and alert proofs through real enqueue/claim/complete operations", () => {
    expect(financialSentinel).toContain('cron: "*/5 * * * *"');
    expect(financialSentinel).toContain("klyx_enqueue_durable_job");
    expect(financialSentinel).toContain("klyx_claim_durable_jobs");
    expect(financialSentinel).toContain("klyx_complete_durable_job");
    expect(financialSentinel).toContain("ops_observability_signals_current");
    expect(financialSentinel).toContain("financial_monitoring_signals_current");
    expect(financialSentinel).toContain("ops_durable_job_dlq");
    expect(financialSentinel).toContain("financial_reconciliation_current");
    expect(financialSentinel).toContain(
      "klyx_record_financial_live_operational_proof"
    );
  });

  it("treats LIVE webhooks and Connect platform truth as a hard readiness gate", () => {
    expect(stripeInfra).toContain('"payment_intent.succeeded"');
    expect(stripeInfra).toContain('"payment_intent.payment_failed"');
    expect(stripeInfra).toContain('"checkout.session.completed"');
    expect(stripeInfra).toContain('"refund.updated"');
    expect(stripeInfra).toContain('"account.updated"');
    expect(stripeInfra).toContain("stripe.webhookEndpoints.list");
    expect(stripeInfra).toContain("account.charges_enabled === true");
    expect(gate).toContain("stripe_payment_webhook_live");
    expect(gate).toContain("stripe_connect_webhook_live");
  });

  it("uses only canonical account Stripe identity for LIVE destinations", () => {
    const strictStart = identity.indexOf(
      "export async function getAccountStripeConnectIdentityStrict"
    );
    const nonStrictStart = identity.indexOf(
      "export async function getAccountStripeConnectIdentity(",
      strictStart + 1
    );
    const strictSlice = identity.slice(strictStart, nonStrictStart);

    expect(strictStart).toBeGreaterThan(-1);
    expect(strictSlice).toContain("readCanonicalIdentity(accountId)");
    expect(strictSlice).not.toContain('.from("profiles")');

    expect(connect).toContain("getCanonicalStripeConnectStrict");
    expect(connect).toContain("getProviderStripeDestinationStrict");
    expect(stripeRuntime).toContain(
      'mode === "live"\n    ? getProviderStripeDestinationStrict'
    );
  });

  it("forbids legacy destination-charge fallback in LIVE", () => {
    expect(settlementControl).toContain(
      "if (requested === KLYX_LEGACY_SETTLEMENT_MODE)"
    );
    expect(settlementControl).toContain(
      'if (secret.startsWith("sk_live_"))'
    );
    expect(settlementControl).toContain(
      "KLYX_SETTLEMENT_CONTROL_LIVE_READY"
    );
  });

  it("requires Economic Eligibility before single and multi-executor LIVE checkout", () => {
    expect(singleCheckout).toContain("canReceiveSettlementForBooking");
    expect(singleCheckout).toContain(
      "KLYX_ECONOMIC_SETTLEMENT_ELIGIBILITY_REQUIRED"
    );
    expect(singleCheckout).toContain("getProviderFinancialDestination");
    expect(groupCheckout).toContain("canReceiveSettlementForBooking");
    expect(groupCheckout).toContain("for (const bookingId of unit.bookingIds)");
    expect(groupCheckout).toContain("getProviderFinancialDestination");
  });

  it("gates every platform-held Stripe money write while leaving webhook reconciliation ungated", () => {
    for (const source of [singleSettlement, groupSettlement]) {
      expect(source).toContain("assertFinancialStripeWriteAuthorized");
    }

    expect(singleSettlement.indexOf("assertFinancialStripeWriteAuthorized"))
      .toBeLessThan(singleSettlement.lastIndexOf("stripe.transfers.create"));
    expect(groupSettlement.indexOf("assertFinancialStripeWriteAuthorized"))
      .toBeLessThan(groupSettlement.lastIndexOf("stripe.refunds.create"));

    expect(paymentWebhook).not.toContain(
      "assertLiveFinancialMutationAuthorized"
    );
    expect(paymentWebhook).not.toContain(
      "assertFinancialStripeWriteAuthorized"
    );
  });
});
