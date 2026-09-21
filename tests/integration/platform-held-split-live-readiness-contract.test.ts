import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX true Split Settlement + Live Readiness contract", () => {
  it("reuses the certified multi-executor financial engine instead of creating a duplicate engine", () => {
    const proof = read(
      "scripts/golden-path-platform-held-group-multiexecutor-network.mjs"
    );
    const engine = read("lib/platform-held-group-settlement-server.ts");

    expect(proof).toContain("executorCount: 2");
    expect(proof).toContain("childBookingCount: 3");
    expect(proof).toContain("onePlatformCharge: true");
    expect(engine).toContain("stripe.transfers.create(");
    expect(engine).toContain("stripe.transfers.createReversal(");
    expect(engine).toContain("stripe.refunds.create(");
  });

  it("proves commission, exact rounding and aggregate accounting", () => {
    const economics = read(
      "tests/unit/group-multiexecutor-settlement-economics.test.ts"
    );
    const proof = read(
      "scripts/golden-path-platform-held-group-multiexecutor-network.mjs"
    );

    expect(economics).toContain("grossAmountCents: 1001");
    expect(economics).toContain("platformFeeCents: 150");
    expect(economics).toContain("providerAmountCents: 851");
    expect(economics).toContain("allocates partial refunds cumulatively without penny drift");
    expect(proof).toContain("aggregateReleaseCapCents");
    expect(proof).toContain("aggregateReleaseCents");
  });

  it("proves partial refunds, partial reversals and an isolated disabled beneficiary", () => {
    const proof = read(
      "scripts/golden-path-platform-held-group-multiexecutor-network.mjs"
    );

    expect(proof).toContain('kind: "partial"');
    expect(proof).toContain("providerReversalCents");
    expect(proof).toContain("stripeAccountDisabledBeforeRelease: true");
    expect(proof).toContain("transferCreated: false");
    expect(proof).toContain("blockedExecutorIsolated: true");
  });

  it("proves idempotent Transfers and Stripe-truth-first reconciliation", () => {
    const proof = read(
      "scripts/golden-path-platform-held-group-multiexecutor-network.mjs"
    );
    const engine = read("lib/platform-held-group-settlement-server.ts");

    expect(proof).toContain("idempotentTransferCount");
    expect(engine).toContain("await listAndValidateTransfers(stripe, parent, members, expectedLive)");
    expect(engine).toContain("await input.stripe.transfers.listReversals");
    expect(engine).toContain("await stripe.refunds.list({");
  });

  it("keeps automated Split network proof TEST-only and app LIVE behind the canary gate", () => {
    const workflow = read(
      ".github/workflows/klyx-stripe-split-settlement-network.yml"
    );
    const engine = read("lib/platform-held-group-settlement-server.ts");
    const runtime = read("lib/klyx-financial-stripe-runtime.ts");

    expect(workflow).toContain('KLYX_STRIPE_MODE: "test"');
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).toContain("sk_test_*");
    expect(engine).toContain("requireKlyxFinancialStripeRuntime");
    expect(runtime).toContain('key.startsWith("sk_live_")');
    expect(runtime).toContain('key.startsWith("sk_test_")');
    expect(runtime).toContain("KLYX_LIVE_CERTIFICATION_SHA");
    expect(runtime).toContain("KLYX_DR_CERTIFIED_SHA");
  });

  it("defines a fail-closed eight-part Live Readiness Gate", () => {
    const gate = read("docs/KLYX_LIVE_READINESS_GATE.md");

    for (const component of [
      "single",
      "recovery",
      "group",
      "split",
      "refunds",
      "Trust & Safety",
      "Stripe identity",
      "reconciliation",
    ]) {
      expect(gate).toContain(component);
    }

    expect(gate).toContain("General Live is OFF");
    expect(gate).toContain("general Stripe Live remains OFF");
    expect(gate).toContain("40 scenario/topology cells");
  });
});
