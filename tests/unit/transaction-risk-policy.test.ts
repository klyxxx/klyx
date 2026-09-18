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

describe("transaction risk policy", () => {
  it("allows ordinary and payment-failure-only payer risk", () => {
    expect(
      assessTransactionRisk({
        action: "checkout_create",
        participant: "payer",
        assessment: assessment("moderate", ["payment_failures"], 20),
        metrics: metrics({ failedPayments: 4 }),
      }).decision
    ).toBe("allow");
  });

  it("does not disable buying because the same account has provider Stripe review", () => {
    expect(
      assessTransactionRisk({
        action: "checkout_create",
        participant: "payer",
        assessment: assessment(
          "high",
          ["financial_identity_review_required"],
          40
        ),
        metrics: metrics({
          isProvider: true,
          identityComplete: false,
          financialIdentityReviewRequired: true,
        }),
      }).decision
    ).toBe("allow");
  });

  it("blocks recipient money flow when canonical financial identity needs review", () => {
    const result = assessTransactionRisk({
      action: "checkout_create",
      participant: "recipient",
      assessment: assessment(
        "high",
        ["financial_identity_review_required"],
        40
      ),
      metrics: metrics({
        isProvider: true,
        identityComplete: false,
        financialIdentityReviewRequired: true,
      }),
    });

    expect(result.decision).toBe("blocked");
    expect(result.reasonCodes).toEqual([
      "financial_identity_review_required",
    ]);
  });

  it("requires review for an urgent safety signal without permanently blocking", () => {
    const result = assessTransactionRisk({
      action: "checkout_create",
      participant: "payer",
      assessment: assessment("high", ["safety_report"], 55),
      metrics: metrics({ urgentSafetyReports: 1 }),
    });

    expect(result.decision).toBe("review_required");
    expect(result.reasonCodes).toContain("urgent_safety_review");
  });

  it("requires review for a materially adverse received-dispute history", () => {
    const result = assessTransactionRisk({
      action: "checkout_create",
      participant: "recipient",
      assessment: assessment(
        "high",
        ["multiple_received_disputes"],
        50
      ),
      metrics: metrics({ receivedDisputes: 3, isProvider: true }),
    });

    expect(result.decision).toBe("review_required");
    expect(result.reasonCodes).toContain(
      "serious_received_dispute_history"
    );
  });
});
