import type {
  RiskAssessment,
  RiskMetrics,
} from "@/lib/security-risk";

export type TransactionRiskAction = "checkout_create" | "refund_create";
export type TransactionRiskParticipant =
  | "payer"
  | "recipient"
  | "requester"
  | "refund_recipient";
export type TransactionRiskDecision =
  | "allow"
  | "review_required"
  | "blocked";

export type TransactionRiskAssessment = {
  action: TransactionRiskAction;
  participant: TransactionRiskParticipant;
  decision: TransactionRiskDecision;
  reasonCodes: string[];
};

type Input = {
  action: TransactionRiskAction;
  participant: TransactionRiskParticipant;
  assessment: RiskAssessment;
  metrics: RiskMetrics;
};

function signalCodes(assessment: RiskAssessment): Set<string> {
  return new Set(assessment.signals.map((signal) => signal.code));
}

function assessRefundRisk(input: Input): TransactionRiskAssessment {
  const { action, participant, assessment, metrics } = input;
  const signals = signalCodes(assessment);

  // A refund returns money to the original payer. Provider-only Stripe identity
  // problems, safety reports received by the requester, or adverse provider
  // history must not strand customer funds. Those signals remain visible in the
  // canonical account assessment, but they do not block a refund by themselves.
  //
  // The one account-level condition that can justify a temporary review here is
  // a critical pattern of disputes OPENED by the refund recipient. This is the
  // double-recovery boundary (refund plus repeated dispute/chargeback behavior),
  // so it is review-only rather than an automatic permanent block.
  const criticalRecipientDisputeRisk =
    participant === "refund_recipient" &&
    assessment.level === "critical" &&
    (signals.has("multiple_opened_disputes") || metrics.openedDisputes >= 3);

  if (criticalRecipientDisputeRisk) {
    return {
      action,
      participant,
      decision: "review_required",
      reasonCodes: ["critical_refund_recipient_dispute_risk"],
    };
  }

  return {
    action,
    participant,
    decision: "allow",
    reasonCodes: [],
  };
}

export function assessTransactionRisk(
  input: Input
): TransactionRiskAssessment {
  const { action, participant, assessment, metrics } = input;

  if (action === "refund_create") {
    return assessRefundRisk(input);
  }

  const signals = signalCodes(assessment);
  const reasons: string[] = [];

  // A provider-side canonical Stripe identity conflict is a hard financial
  // boundary. It is intentionally ignored when the same account acts only as
  // the payer, so a provider identity review cannot arbitrarily disable buying.
  if (
    participant === "recipient" &&
    signals.has("financial_identity_review_required")
  ) {
    return {
      action,
      participant,
      decision: "blocked",
      reasonCodes: ["financial_identity_review_required"],
    };
  }

  // Open urgent safety reports require human review before KLYX creates a new
  // payment. This is transaction-scoped and never becomes a permanent account
  // suspension by itself.
  if (signals.has("safety_report") || metrics.urgentSafetyReports > 0) {
    reasons.push("urgent_safety_review");
  }

  // Failed cards and cancellation patterns alone are not fraud proof. Only a
  // materially adverse received-dispute history can escalate a high/critical
  // behavioral score into a pre-payment review.
  const seriousReceivedDisputeHistory =
    signals.has("multiple_received_disputes") &&
    (metrics.receivedDisputes >= 3 ||
      assessment.level === "high" ||
      assessment.level === "critical");

  if (seriousReceivedDisputeHistory) {
    reasons.push("serious_received_dispute_history");
  }

  const criticalDisputeCombination =
    assessment.level === "critical" &&
    (signals.has("multiple_opened_disputes") ||
      signals.has("multiple_received_disputes"));

  if (criticalDisputeCombination) {
    reasons.push("critical_dispute_risk");
  }

  if (reasons.length > 0) {
    return {
      action,
      participant,
      decision: "review_required",
      reasonCodes: Array.from(new Set(reasons)),
    };
  }

  return {
    action,
    participant,
    decision: "allow",
    reasonCodes: [],
  };
}
