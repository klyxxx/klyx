import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const singleWrapper = read("app/api/stripe/create-checkout-session/route.ts");
const singleCore = read("app/api/stripe/create-checkout-session/route-core.ts");
const groupWrapper = read("app/api/stripe/create-group-checkout-session/route.ts");
const groupCore = read("app/api/stripe/create-group-checkout-session/route-core.ts");
const splitWrapper = read(
  "app/api/bookings/split-missions/[id]/checkout/route.ts"
);
const splitCore = read(
  "app/api/bookings/split-missions/[id]/checkout/route-core.ts"
);
const server = read("lib/transaction-risk-server.ts");
const migration = read(
  "supabase/migrations/20260915113000_klyx_transaction_risk_gate.sql"
);

describe("transaction risk gate contract", () => {
  it("runs canonical risk preflight before delegating every checkout", () => {
    for (const wrapper of [singleWrapper, groupWrapper]) {
      const executable = executableSource(wrapper);
      const gate = executable.indexOf("enforceCheckoutTransactionRisk({");
      const delegatedCore = executable.lastIndexOf("return corePost(");

      expect(gate).toBeGreaterThan(-1);
      expect(delegatedCore).toBeGreaterThan(gate);
      expect(executable).toContain("automaticSuspension: false");
      expect(executable).not.toContain("stripe.checkout.sessions.create");
    }

    const splitExecutable = executableSource(splitWrapper);
    const splitGate = splitExecutable.indexOf(
      "enforceCheckoutTransactionRisk({"
    );
    const splitDelegatedCore = splitExecutable.lastIndexOf(
      "return selectedPost(request, context)"
    );

    expect(splitGate).toBeGreaterThan(-1);
    expect(splitDelegatedCore).toBeGreaterThan(splitGate);
    expect(splitExecutable).toContain("platformHeldPost");
    expect(splitExecutable).toContain("automaticSuspension: false");
    expect(splitExecutable).not.toContain("stripe.checkout.sessions.create");
  });

  it("keeps Stripe creation, claims and idempotency inside frozen cores", () => {
    expect(singleCore).toContain("stripe.checkout.sessions.create");
    expect(singleCore).toContain("klyx_claim_booking_payment");
    expect(singleCore).toContain("klyx-booking-${booking.id}-attempt-");
    expect(singleCore).toContain("application_fee_amount");
    expect(singleCore).toContain("transfer_data");

    expect(groupCore).toContain("stripe.checkout.sessions.create");
    expect(groupCore).toContain("klyx_claim_booking_group_payment");
    expect(groupCore).toContain("klyx-booking-group-");
    expect(groupCore).toContain("application_fee_amount");
    expect(groupCore).toContain("transfer_data");

    expect(splitCore).toContain("stripe.checkout.sessions.create");
    expect(splitCore).toContain("klyx_claim_split_payment_unit_13_27");
    expect(splitCore).toContain("klyx-split-unit-");
    expect(splitCore).toContain("application_fee_amount");
    expect(splitCore).toContain("transfer_data");
  });

  it("evaluates payer and recipient canonical accounts and fails closed", () => {
    expect(server).toContain("evaluateCanonicalAccountRisk(");
    expect(server).toContain("evaluateCanonicalAccountRiskById(");
    expect(server).toContain("resolveCanonicalAccountIdsForProfiles");
    expect(server).toContain("transaction_risk_decisions");
    expect(server).toContain("TransactionRiskGateError");
    expect(server).toContain('participant: "payer"');
    expect(server).toContain('participant: "recipient"');
  });

  it("keeps decision audit server-only and transaction-scoped", () => {
    expect(migration).toContain("create table if not exists public.transaction_risk_decisions");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all privileges");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("checkout_create");
    expect(migration).toContain("payer");
    expect(migration).toContain("recipient");
    expect(migration).not.toContain("suspended");
    expect(migration).not.toContain("banned");
  });
});