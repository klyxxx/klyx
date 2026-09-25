import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const pureShadow = fs.readFileSync(
  path.join(root, "lib/pure-finance/shadow-reconciliation.ts"),
  "utf8"
);
const serverShadow = fs.readFileSync(
  path.join(root, "lib/pure-finance-shadow-server.ts"),
  "utf8"
);
const route = fs.readFileSync(
  path.join(root, "app/api/ops/pure-finance-shadow/route.ts"),
  "utf8"
);

describe("KLYX pure-finance runtime shadow contract", () => {
  it("keeps the deterministic comparator provider and database independent", () => {
    expect(pureShadow).toContain("comparePureFinanceRecognitionShadow");
    expect(pureShadow).toContain("createFinancialState");
    expect(pureShadow).toContain("projectFinancialStateToCanonicalLedger");
    expect(pureShadow).not.toContain('import "server-only"');
    expect(pureShadow).not.toMatch(/stripe/i);
    expect(pureShadow).not.toMatch(/supabase/i);
    expect(pureShadow).not.toContain("fetch(");
    expect(pureShadow).not.toContain("Date.now");
    expect(pureShadow).not.toContain("Math.random");
  });

  it("reads legacy runtime truth but never mutates money or the canonical ledger", () => {
    expect(serverShadow).toContain("comparePureFinanceRecognitionShadow");
    expect(serverShadow).toContain('from("financial_ledger_current")');
    expect(serverShadow).toContain("klyx_group_member_booking_economics");
    expect(serverShadow).toContain("openFinancialReconciliationCase");
    expect(serverShadow).toContain('state: "human_review"');
    expect(serverShadow).toContain('dimension: "pure_finance"');
    expect(serverShadow).toContain('cause: "pure_finance_shadow_divergence"');

    for (const forbidden of [
      "appendFinancialLedgerEvent",
      "transfers.create",
      "refunds.create",
      "paymentIntents.create",
      "stripe.transfers",
      "stripe.refunds",
    ]) {
      expect(serverShadow).not.toContain(forbidden);
    }
  });

  it("reuses the authenticated reconciliation operations boundary", () => {
    expect(route).toContain("KLYX_FINANCIAL_RECONCILIATION_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("verifyPureFinanceRecognitionShadow");
    expect(route).toContain('"Cache-Control": "no-store"');
    expect(route).not.toContain("STRIPE_SECRET_KEY");
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
