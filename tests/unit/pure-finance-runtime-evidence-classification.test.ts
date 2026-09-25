import { describe, expect, it } from "vitest";

import { classifyPureFinanceRuntimeEvidence } from "../../lib/pure-finance/runtime-evidence-classification";

const LEDGER_START = "2026-09-20T16:04:59.823Z";

describe("KLYX pure-finance runtime evidence classification", () => {
  it("classifies a post-boundary runtime payment as current runtime", () => {
    expect(
      classifyPureFinanceRuntimeEvidence({
        paymentStatus: "paid",
        paymentMode: "platform_held",
        paidAt: "2026-09-25T12:00:00.000Z",
        effectiveLedgerSources: ["stripe_webhook"],
        centralLedgerFirstRecordedAt: LEDGER_START,
      })
    ).toEqual({
      evidenceClass: "current_runtime",
      evidenceBasis: "current_runtime",
    });
  });

  it("classifies a final payment before the central-ledger boundary as legacy historical", () => {
    expect(
      classifyPureFinanceRuntimeEvidence({
        paymentStatus: "refunded",
        paymentMode: "connect_destination",
        paidAt: "2026-08-06T12:40:06.834Z",
        effectiveLedgerSources: ["historical_backfill"],
        centralLedgerFirstRecordedAt: LEDGER_START,
      })
    ).toEqual({
      evidenceClass: "legacy_historical",
      evidenceBasis: "paid_before_central_ledger",
    });
  });

  it("classifies historical-backfill-only evidence as legacy historical", () => {
    expect(
      classifyPureFinanceRuntimeEvidence({
        paymentStatus: "paid",
        paymentMode: "connect_destination",
        paidAt: "2026-09-25T12:00:00.000Z",
        effectiveLedgerSources: ["historical_backfill", "historical_backfill"],
        centralLedgerFirstRecordedAt: LEDGER_START,
      })
    ).toEqual({
      evidenceClass: "legacy_historical",
      evidenceBasis: "historical_backfill_only",
    });
  });

  it("classifies platform_test_only as not applicable", () => {
    expect(
      classifyPureFinanceRuntimeEvidence({
        paymentStatus: "paid",
        paymentMode: "platform_test_only",
        paidAt: "2026-08-05T13:50:55.874Z",
        effectiveLedgerSources: [],
        centralLedgerFirstRecordedAt: LEDGER_START,
      })
    ).toEqual({
      evidenceClass: "not_applicable",
      evidenceBasis: "test_only_payment_mode",
    });
  });

  it("classifies non-final payment truth as not applicable", () => {
    expect(
      classifyPureFinanceRuntimeEvidence({
        paymentStatus: "pending",
        paymentMode: "platform_held",
        paidAt: null,
        effectiveLedgerSources: [],
        centralLedgerFirstRecordedAt: LEDGER_START,
      })
    ).toEqual({
      evidenceClass: "not_applicable",
      evidenceBasis: "payment_not_final",
    });
  });

  it("fails toward current-runtime classification when the ledger boundary is unavailable", () => {
    expect(
      classifyPureFinanceRuntimeEvidence({
        paymentStatus: "paid",
        paymentMode: "platform_held",
        paidAt: "2026-08-05T13:50:55.874Z",
        effectiveLedgerSources: [],
        centralLedgerFirstRecordedAt: null,
      })
    ).toEqual({
      evidenceClass: "current_runtime",
      evidenceBasis: "current_runtime",
    });
  });
});
