export const POST_BOOKING_INCIDENT_TYPES = [
  "cancellation",
  "provider_no_show",
  "client_no_show",
  "delay",
  "impossible_mission",
  "quality_issue",
  "replacement_request",
  "dispute",
  "refund_expected",
] as const;

export type PostBookingIncidentType =
  (typeof POST_BOOKING_INCIDENT_TYPES)[number];

export type PostBookingReporterRole = "client" | "provider";
export type PostBookingRefundHandling =
  | "none"
  | "existing_policy"
  | "human_review";
export type PostBookingTrustCaseType = "no_show" | "dispute" | "other";
export type PostBookingTrustSeverity = "low" | "medium" | "high";

export const POST_BOOKING_INCIDENT_POLICY_VERSION =
  "post_booking_incident_v1";

export type PostBookingIncidentPolicyDecision = {
  policyVersion: string;
  replacementEligible: boolean;
  humanReviewRequired: boolean;
  trustCaseType: PostBookingTrustCaseType | null;
  trustSeverity: PostBookingTrustSeverity;
  refundHandling: PostBookingRefundHandling;
  reasonCode: string;
  automaticSanctionAllowed: false;
  llmDecisionAllowed: false;
};

export function isPostBookingIncidentType(
  value: unknown
): value is PostBookingIncidentType {
  return (
    typeof value === "string" &&
    POST_BOOKING_INCIDENT_TYPES.includes(value as PostBookingIncidentType)
  );
}

export function incidentAllowedForRole(
  incidentType: PostBookingIncidentType,
  reporterRole: PostBookingReporterRole
): boolean {
  if (incidentType === "provider_no_show") return reporterRole === "client";
  if (incidentType === "client_no_show") return reporterRole === "provider";
  if (incidentType === "replacement_request") return reporterRole === "client";
  return true;
}

function paidRefundHandling(params: {
  paymentStatus: string | null;
  afterStart: boolean;
}): PostBookingRefundHandling {
  if (params.paymentStatus !== "paid") return "none";
  return params.afterStart ? "human_review" : "existing_policy";
}

export function evaluatePostBookingIncidentPolicy(input: {
  incidentType: PostBookingIncidentType;
  reporterRole: PostBookingReporterRole;
  paymentStatus: string | null;
  afterStart: boolean;
}): PostBookingIncidentPolicyDecision {
  const refundHandling = paidRefundHandling(input);

  switch (input.incidentType) {
    case "provider_no_show":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: input.reporterRole === "client",
        humanReviewRequired: true,
        trustCaseType: "no_show",
        trustSeverity: "high",
        refundHandling:
          input.paymentStatus === "paid" ? "human_review" : "none",
        reasonCode: "provider_no_show_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "client_no_show":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: false,
        humanReviewRequired: true,
        trustCaseType: "no_show",
        trustSeverity: "high",
        refundHandling:
          input.paymentStatus === "paid" ? "human_review" : "none",
        reasonCode: "client_no_show_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "quality_issue":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: false,
        humanReviewRequired: true,
        trustCaseType: "dispute",
        trustSeverity: "medium",
        refundHandling:
          input.paymentStatus === "paid" ? "human_review" : "none",
        reasonCode: "quality_issue_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "dispute":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: false,
        humanReviewRequired: true,
        trustCaseType: "dispute",
        trustSeverity: "medium",
        refundHandling:
          input.paymentStatus === "paid" ? "human_review" : "none",
        reasonCode: "booking_dispute_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "refund_expected":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: false,
        humanReviewRequired: refundHandling === "human_review",
        trustCaseType:
          refundHandling === "human_review" ? "dispute" : null,
        trustSeverity: "medium",
        refundHandling,
        reasonCode:
          refundHandling === "human_review"
            ? "refund_requires_human_review"
            : "refund_uses_existing_policy",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "cancellation":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: input.reporterRole === "client",
        humanReviewRequired: refundHandling === "human_review",
        trustCaseType:
          refundHandling === "human_review" ? "dispute" : null,
        trustSeverity: "medium",
        refundHandling,
        reasonCode: "counterparty_cancellation_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "impossible_mission":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: input.reporterRole === "client",
        humanReviewRequired:
          input.afterStart && input.paymentStatus === "paid",
        trustCaseType:
          input.afterStart && input.paymentStatus === "paid" ? "other" : null,
        trustSeverity: "medium",
        refundHandling:
          input.afterStart && input.paymentStatus === "paid"
            ? "human_review"
            : "none",
        reasonCode: "mission_impossible_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "replacement_request":
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: input.reporterRole === "client",
        humanReviewRequired: false,
        trustCaseType: null,
        trustSeverity: "low",
        refundHandling: "none",
        reasonCode: "replacement_requested",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };

    case "delay":
    default:
      return {
        policyVersion: POST_BOOKING_INCIDENT_POLICY_VERSION,
        replacementEligible: false,
        humanReviewRequired: false,
        trustCaseType: null,
        trustSeverity: "low",
        refundHandling: "none",
        reasonCode: "delay_reported",
        automaticSanctionAllowed: false,
        llmDecisionAllowed: false,
      };
  }
}

export function buildPostBookingIncidentMessage(params: {
  incidentType: PostBookingIncidentType;
  replacementCandidateCount: number;
  humanReviewRequired: boolean;
  refundHandling: PostBookingRefundHandling;
  refundStatus?: string | null;
}): string {
  const count = Math.max(0, Math.floor(params.replacementCandidateCount));

  if (count > 0) {
    const replacementText =
      `J’ai trouvé ${count} remplaçant${count > 1 ? "s" : ""} compatible${
        count > 1 ? "s" : ""
      }. Veux-tu que je te présente le meilleur ?`;

    if (params.incidentType === "cancellation") {
      return `La personne a annulé. ${replacementText}`;
    }

    if (params.incidentType === "provider_no_show") {
      return `Le prestataire ne s’est pas présenté. ${replacementText}`;
    }

    if (params.incidentType === "impossible_mission") {
      return `La mission ne peut pas se poursuivre comme prévu. ${replacementText}`;
    }

    return replacementText;
  }

  if (params.refundStatus === "succeeded") {
    return "Le remboursement prévu par les règles KLYX est déjà confirmé. Je conserve l’incident et son historique.";
  }

  if (params.humanReviewRequired) {
    return "J’ai enregistré l’incident et demandé une revue humaine. Aucune sanction ni décision Trust & Safety n’est prise automatiquement.";
  }

  if (params.refundHandling === "existing_policy") {
    return "J’ai enregistré l’incident. Le remboursement reste traité par les règles de remboursement KLYX déjà en place, sans nouveau débit.";
  }

  if (
    params.incidentType === "replacement_request" ||
    params.incidentType === "cancellation" ||
    params.incidentType === "impossible_mission"
  ) {
    return "J’ai enregistré l’incident, mais je n’ai pas trouvé de remplaçant exact pour ce créneau. Je ne réserverai personne sans ton accord.";
  }

  return "J’ai enregistré l’incident avec sa raison et ses preuves. Aucune action irréversible n’est déclenchée automatiquement.";
}
