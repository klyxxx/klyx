import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const evidence = fs.readFileSync(
  path.join(root, "lib/pure-finance/controlled-shadow-evidence.ts"),
  "utf8"
);
const batchServer = fs.readFileSync(
  path.join(root, "lib/pure-finance-shadow-batch-server.ts"),
  "utf8"
);
const route = fs.readFileSync(
  path.join(root, "app/api/ops/pure-finance-shadow/route.ts"),
  "utf8"
);

describe("KLYX controlled pure-finance shadow contract", () => {
  it("keeps the evidence gate deterministic and provider independent", () => {
    expect(evidence).toContain("certifyControlledPureFinanceShadowEvidence");
    expect(evidence).toContain('"fail_closed"');
    expect(evidence).toContain('"insufficient_evidence"');
    expect(evidence).toContain('"current_runtime"');
    expect(evidence).toContain('"legacy_historical"');
    expect(evidence).toContain("legacyHistoricalCount");
    expect(evidence).not.toContain('import "server-only"');
    expect(evidence).not.toMatch(/stripe/i);
    expect(evidence).not.toMatch(/supabase/i);
    expect(evidence).not.toContain("fetch(");
    expect(evidence).not.toContain("Date.now");
    expect(evidence).not.toContain("Math.random");
  });

  it("only evaluates explicitly supplied bookings with a bounded sequential batch", () => {
    expect(batchServer).toContain("MAX_CONTROLLED_PURE_FINANCE_SHADOW_BOOKINGS = 25");
    expect(batchServer).toContain("verifyPureFinanceRuntimeShadow");
    expect(batchServer).toContain("for (const bookingId of bookingIds)");
    expect(batchServer).toContain("evidenceClass: result.evidenceClass");
    expect(batchServer).toContain("evidenceBasis: result.evidenceBasis");
    expect(batchServer).toContain('evidenceClass: "current_runtime"');
    expect(batchServer).toContain('scope: "controlled_real_runtime"');
    expect(batchServer).toContain('authority: "shadow_only"');
    expect(batchServer).toContain("writerReplacementAuthorized: false");
    expect(batchServer).toContain("liveActivationAuthorized: false");
    expect(batchServer).not.toContain('from("bookings")');
    expect(batchServer).not.toContain("transfers.create");
    expect(batchServer).not.toContain("refunds.create");
    expect(batchServer).not.toContain("paymentIntents.create");
  });

  it("reuses the authenticated operations boundary for controlled batch evidence", () => {
    expect(route).toContain("KLYX_FINANCIAL_RECONCILIATION_SECRET");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("verifyControlledPureFinanceRuntimeShadow");
    expect(route).toContain("bookingIds");
    expect(route).toContain('mode: "controlled_batch"');
    expect(route).toContain('"Cache-Control": "no-store"');
    expect(route).not.toContain("STRIPE_SECRET_KEY");
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
