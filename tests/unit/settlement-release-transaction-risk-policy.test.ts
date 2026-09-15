import { describe, expect, it } from "vitest";

import type { RiskAssessment, RiskMetrics } from "@/lib/security-risk";
import { assessTransactionRisk } from "@/lib/transaction-risk-policy";

function metrics(overrides: Partial<RiskMetrics> = {}): RiskMetrics {
  return {
    totalBookings: 0,
    cancelledBookings: 0,
    rejectedBookings: 0,
    paidBookings: 0,
    failedPayments: 0,
    openedDisputes: 0,
    receivedDisputes: 0,
    urgentSafetyReports: 0,
    completedBookings: 0,
    isProvider: true,
    identityComplete: true,
    financialIdentityReviewRequired: false,
    ...overrides,
  };
}

function assessment(
  level: RiskAssessment["level"],
  codes: string[],
  score = 0
): RiskAssessment {
  return {
    score,
    level,
    signals: codes.map((code) => ({
      code,
      label: code,
      detail: code,
      points: 10,
    })),
    recommendations: [],
  };
}

describe("settlement release transaction risk policy", () => {
  it("blocks money release to a provider with canonical Stripe identity conflict", () => {
    const result = assessTransactionRisk({
      action: "settlement_release",
      participant: "settlement_recipient",
      assessment: assessment(
        "high",
        ["financial_identity_review_required"],
        55
      ),
      metrics: metrics({
        identityComplete: false,
        financialIdentityReviewRequired: true,
      }),
    });

    expect(result.decision).toBe("blocked");
    expect(result.reasonCodes).toEqual([
      "financial_identity_review_required",
    ]);
  });

  it("requires human review before release when urgent safety risk is open", () => {
    const result = assessTransactionRisk({
      action: "settlement_release",
      participant: "settlement_recipient",
      assessment: assessment("high", ["safety_report"], 60),
      metrics: metrics({ urgentSafetyReports: 1 }),
    });

    expect(result.decision).toBe("review_required");
    expect(result.reasonCodes).toContain("urgent_safety_review");
  });

  it("requires review for serious received dispute history", () => {
    const result = assessTransactionRisk({
      action: "settlement_release",
      participant: "settlement_recipient",
      assessment: assessment("high", ["multiple_received_disputes"], 65),
      metrics: metrics({ receivedDisputes: 4 }),
    });

    expect(result.decision).toBe("review_required");
    expect(result.reasonCodes).toContain("serious_received_dispute_history");
  });

  it("allows a clean canonical provider account", () => {
    const result = assessTransactionRisk({
      action: "settlement_release",
      participant: "settlement_recipient",
      assessment: assessment("low", [], 5),
      metrics: metrics(),
    });

    expect(result.decision).toBe("allow");
    expect(result.reasonCodes).toEqual([]);
  });
});
