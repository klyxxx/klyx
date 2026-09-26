import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const workflow = read(
  ".github/workflows/klyx-integrated-financial-test-48.yml"
);
const matrix = read(
  "tests/integration/integrated-financial-test-48.test.ts"
);
const summary = read("scripts/summarize-integrated-financial-test-48.mjs");

describe("KLYX Integrated Financial TEST 48 contract", () => {
  it("requires the exact 12 by 4 matrix", () => {
    for (const scenario of [
      "success",
      "failed_payment",
      "failed_transfer",
      "timeout",
      "duplicate_webhook",
      "late_webhook",
      "missing_webhook",
      "retry",
      "double_click",
      "partial_refund",
      "full_refund",
      "reversal",
    ]) {
      expect(matrix).toContain(`\"${scenario}\"`);
      expect(summary).toContain(`\"${scenario}\"`);
    }

    for (const topology of ["single", "group", "split", "multi_provider"]) {
      expect(matrix).toContain(`\"${topology}\"`);
      expect(summary).toContain(`\"${topology}\"`);
    }

    expect(matrix).toContain("SCENARIOS.length * TOPOLOGIES.length").toContain;
    expect(summary).toContain("requiredCellCount: 48");
    expect(workflow).toContain("Enforce 48 of 48 PASS");
  });

  it("keeps Stripe LIVE impossible in this certification", () => {
    expect(workflow).toContain('KLYX_STRIPE_MODE: "test"');
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).toContain('KLYX_FINANCIAL_TEST_48_MODE: "simulated_test"');
    expect(workflow).not.toContain("sk_live_");
    expect(workflow).not.toContain("pk_live_");
    expect(matrix).not.toContain("stripe.transfers.create");
    expect(matrix).not.toContain("stripe.refunds.create");
    expect(matrix).not.toContain("stripe.paymentIntents.create");
  });

  it("fails closed unless main and Vercel production match the requested SHA", () => {
    expect(workflow).toContain("Verify immutable exact main SHA");
    expect(workflow).toContain("git/ref/heads/main");
    expect(workflow).toContain("Verify Vercel production exposes the exact SHA");
    expect(workflow).toContain("/api/health/build");
    expect(workflow).toContain("Vercel production SHA mismatch");
  });

  it("reuses existing exact-SHA certifications instead of rebuilding them", () => {
    expect(workflow).toContain("KLYX E2E");
    expect(workflow).toContain("KLYX Golden Path");
    expect(workflow).toContain("KLYX Pure Finance Certification");
    expect(workflow).toContain("Reusing existing PASS");
  });

  it("verifies Supabase production read-only and never applies migrations", () => {
    expect(workflow).toContain("supabase migration list --db-url");
    expect(workflow).toContain("supabase db push --db-url");
    expect(workflow).toContain("--dry-run");
    expect(workflow).not.toContain("supabase db push --db-url \"$SUPABASE_EFFECTIVE_DB_URL\" | ");
  });

  it("uses the existing financial and resilience engines", () => {
    expect(matrix).toContain('from "../../lib/pure-finance/engine"');
    expect(matrix).toContain('from "../../lib/pure-finance/ledger-projection"');
    expect(matrix).toContain('from "../../lib/pure-finance/runtime-shadow"');
    expect(matrix).toContain('from "../../lib/resilience-engine"');
    expect(matrix).toContain('from "../../lib/resilience-memory-adapter"');
  });

  it("proves divergence blocks and routes to reconciliation plus human review", () => {
    expect(matrix).toContain('status: "human_review"');
    expect(matrix).toContain("blocked: true");
    expect(matrix).toContain("reconciliationRequired: true");
    expect(matrix).toContain("humanReview: true");
    expect(summary).toContain("block -> reconciliation -> human_review");
  });
});
