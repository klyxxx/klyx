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
    isProvider: false,
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

describe("refund transaction risk policy", () => {
  it("does not strand customer funds because the recipient also has provider Stripe identity review", () => {
    const result = assessTransactionRisk({
      action: "refund_create",
      participant: "refund_recipient",
      assessment: assessment(
        "high",
        ["financial_identity_review_required"],
        45
      ),
      metrics: metrics({
        isProvider: true,
        identityComplete: false,
        financialIdentityReviewRequired: true,
      }),
    });

    expect(result.decision).toBe("allow");
  });

  it("does not block a customer refund because the requester has an urgent safety report", () => {
    const result = assessTransactionRisk({
      action: "refund_create",
      participant: "requester",
      assessment: assessment("critical", ["safety_report"], 80),
      metrics: metrics({ urgentSafetyReports: 2, isProvider: true }),
    });

    expect(result.decision).toBe("allow");
  });

  it("requires human review for critical repeated disputes opened by the refund recipient", () => {
    const result = assessTransactionRisk({
      action: "refund_create",
      participant: "refund_recipient",
      assessment: assessment("critical", ["multiple_opened_disputes"], 85),
      metrics: metrics({ openedDisputes: 4 }),
    });

    expect(result.decision).toBe("review_required");
    expect(result.reasonCodes).toEqual([
      "critical_refund_recipient_dispute_risk",
    ]);
  });

  it("does not reinterpret disputes received by the refund recipient as double recovery", () => {
    const result = assessTransactionRisk({
      action: "refund_create",
      participant: "refund_recipient",
      assessment: assessment("critical", ["multiple_received_disputes"], 80),
      metrics: metrics({ receivedDisputes: 5 }),
    });

    expect(result.decision).toBe("allow");
  });
});
