import { describe, expect, it } from "vitest";

import {
  canRequestTrustReview,
  redactTrustDecision,
  type TrustDecisionRow,
} from "../../lib/trust-safety/application-contract";

const row: TrustDecisionRow = {
  id: "decision-1",
  target_type: "booking",
  target_ref: "booking-1",
  category_key: "cleaning",
  jurisdiction_code: "BE-BRU",
  decision: "human_review_required",
  legal_pathway: "multiple_possible",
  human_review_required: true,
  review_status: "not_required",
  reason_codes: ["LEGAL_PATHWAY_UNDETERMINED", 42],
  required_actions: [
    { code: "REQUEST_LEGAL_REVIEW", detail: "Belgium" },
    { nope: true },
  ],
  explanation: "A human must review the applicable delivery framework.",
  created_at: "2026-09-13T00:00:00.000Z",
  expires_at: null,
};

describe("KLYX Trust & Safety application contract", () => {
  it("returns a purpose-limited decision payload", () => {
    const redacted = redactTrustDecision(row);

    expect(redacted).toEqual({
      id: "decision-1",
      targetType: "booking",
      targetRef: "booking-1",
      categoryKey: "cleaning",
      jurisdictionCode: "BE-BRU",
      decision: "human_review_required",
      legalPathway: "multiple_possible",
      humanReviewRequired: true,
      reviewStatus: "not_required",
      reasonCodes: ["LEGAL_PATHWAY_UNDETERMINED"],
      requiredActions: [
        { code: "REQUEST_LEGAL_REVIEW", detail: "Belgium" },
      ],
      explanation: "A human must review the applicable delivery framework.",
      createdAt: "2026-09-13T00:00:00.000Z",
      expiresAt: null,
    });

    expect(redacted).not.toHaveProperty("input_snapshot");
    expect(redacted).not.toHaveProperty("account_id");
    expect(redacted).not.toHaveProperty("legal_assessment_id");
  });

  it("allows a required human review when no review is already pending", () => {
    expect(canRequestTrustReview(row, "human_review")).toBe(true);
  });

  it("does not duplicate a pending review", () => {
    expect(
      canRequestTrustReview(
        { ...row, review_status: "pending" },
        "human_review"
      )
    ).toBe(false);
  });

  it("allows an appeal for adverse outcomes but not a clean eligible decision", () => {
    expect(
      canRequestTrustReview(
        {
          ...row,
          decision: "ineligible",
          human_review_required: false,
          review_status: "not_required",
        },
        "appeal"
      )
    ).toBe(true);

    expect(
      canRequestTrustReview(
        {
          ...row,
          decision: "eligible",
          human_review_required: false,
          review_status: "not_required",
        },
        "appeal"
      )
    ).toBe(false);
  });
});
