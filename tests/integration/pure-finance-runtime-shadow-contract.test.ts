import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const pureShadow = fs.readFileSync(
  path.join(root, "lib/pure-finance/runtime-shadow.ts"),
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

describe("KLYX pure-finance full runtime shadow contract", () => {
  it("keeps the deterministic comparator provider and database independent", () => {
    expect(pureShadow).toContain("certifyPureFinanceRuntimeShadow");
    expect(pureShadow).toContain("createFinancialState");
    expect(pureShadow).toContain("settleProviderLiability");
    expect(pureShadow).toContain("reverseTransfer");
    expect(pureShadow).toContain("refundCharge");
    expect(pureShadow).toContain("projectPayout");
    expect(pureShadow).not.toContain('import "server-only"');
    expect(pureShadow).not.toMatch(/supabase/i);
    expect(pureShadow).not.toContain("fetch(");
    expect(pureShadow).not.toContain("Date.now");
    expect(pureShadow).not.toContain("Math.random");
  });

  it("reads canonical runtime truth but never mutates money or the canonical ledger", () => {
    expect(serverShadow).toContain("certifyPureFinanceRuntimeShadow");
    expect(serverShadow).toContain('from("financial_ledger_current")');
    expect(serverShadow).toContain("klyx_group_member_booking_economics");
    expect(serverShadow).toContain("isEffectiveLedgerRow");
    expect(serverShadow).toContain("openFinancialReconciliationCase");
    expect(serverShadow).toContain('state: "human_review"');
    expect(serverShadow).toContain('dimension: "pure_finance_runtime"');
    expect(serverShadow).toContain(
      'cause: "pure_finance_runtime_shadow_divergence"'
    );

    for (const forbidden of [
      "appendFinancialLedgerEvent",
      "transfers.create",
      "refunds.create",
      "paymentIntents.create",
      "stripe.transfers",
      "stripe.refunds",
      "klyx_append_financial_ledger_event",
    ]) {
      expect(serverShadow).not.toContain(forbidden);
    }
  });

  it("excludes test-only bookings from real-runtime financial evidence", () => {
    expect(serverShadow).toContain(
      'booking.payment_mode === "platform_test_only"'
    );
    expect(serverShadow).toContain(
      '"PURE_FINANCE_RUNTIME_TEST_ONLY_PAYMENT_MODE"'
    );
    expect(serverShadow).toContain('status: "not_applicable"');
  });

  it("covers the entire canonical chain in the pure comparator", () => {
    for (const movement of [
      "charge",
      "commission",
      "provider_liability",
      "transfer",
      "reversal",
      "refund",
      "payout",
    ]) {
      expect(pureShadow).toContain(movement);
    }
    expect(pureShadow).toContain("PURE_FINANCE_RUNTIME_REQUIRED_REVERSAL_MISSING");
    expect(pureShadow).toContain("PURE_FINANCE_RUNTIME_PAYOUT_MISMATCH");
    expect(pureShadow).toContain("PURE_FINANCE_RUNTIME_BENEFICIARY_MISMATCH");
  });

  it("reuses the authenticated reconciliation operations boundary", () => {
    expect(route).toContain("KLYX_FINANCIAL_RECONCILIATION_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("verifyPureFinanceRuntimeShadow");
    expect(route).toContain('"Cache-Control": "no-store"');
    expect(route).not.toContain("STRIPE_SECRET_KEY");
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
