export type TrustDecisionKind =
  | "eligible"
  | "eligible_with_conditions"
  | "requirements_missing"
  | "human_review_required"
  | "ineligible";

export type TrustReviewKind = "human_review" | "appeal";

export type TrustDecisionRow = {
  id: string;
  target_type: string;
  target_ref: string | null;
  category_key: string;
  jurisdiction_code: string;
  decision: TrustDecisionKind;
  legal_pathway: string;
  human_review_required: boolean;
  review_status: string;
  reason_codes: unknown;
  required_actions: unknown;
  explanation: string;
  created_at: string;
  expires_at: string | null;
};

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function asRequiredActions(
  value: unknown
): Array<{ code: string; detail?: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.code !== "string" || !candidate.code.trim()) {
        return null;
      }

      const detail =
        typeof candidate.detail === "string" && candidate.detail.trim()
          ? candidate.detail.trim().slice(0, 240)
          : undefined;

      return { code: candidate.code.trim().slice(0, 120), detail };
    })
    .filter(
      (item): item is { code: string; detail?: string } => item !== null
    )
    .slice(0, 50);
}

export function redactTrustDecision(row: TrustDecisionRow) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetRef: row.target_ref,
    categoryKey: row.category_key,
    jurisdictionCode: row.jurisdiction_code,
    decision: row.decision,
    legalPathway: row.legal_pathway,
    humanReviewRequired: row.human_review_required,
    reviewStatus: row.review_status,
    reasonCodes: asStringArray(row.reason_codes),
    requiredActions: asRequiredActions(row.required_actions),
    explanation: row.explanation,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function canRequestTrustReview(
  decision: Pick<
    TrustDecisionRow,
    "decision" | "human_review_required" | "review_status"
  >,
  reviewKind: TrustReviewKind
): boolean {
  if (reviewKind === "human_review") {
    if (
      decision.review_status === "approved" ||
      decision.review_status === "rejected"
    ) {
      return false;
    }

    return (
      decision.human_review_required ||
      decision.decision === "human_review_required"
    );
  }

  return (
    decision.decision === "ineligible" ||
    decision.decision === "requirements_missing" ||
    decision.decision === "human_review_required"
  );
}
