import { NextResponse } from "next/server";

import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  asRequiredActions,
  asStringArray,
} from "@/lib/trust-safety/application-contract";

type ReviewBody = {
  reviewId?: unknown;
  action?: unknown;
  rationale?: unknown;
  replacementDecision?: unknown;
  reasonCodes?: unknown;
  requiredActions?: unknown;
  explanation?: unknown;
};

const REPLACEMENT_DECISIONS = new Set([
  "eligible",
  "eligible_with_conditions",
  "requirements_missing",
  "human_review_required",
  "ineligible",
]);

function rpcErrorStatus(message: string): number {
  if (
    message.includes("KLYX_TRUST_REVIEW_NOT_FOUND") ||
    message.includes("KLYX_TRUST_DECISION_NOT_FOUND")
  ) {
    return 404;
  }

  if (message.includes("KLYX_TRUST_REVIEW_ALREADY_RESOLVED")) return 409;
  if (message.includes("KLYX_TRUST_")) return 400;
  return 500;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    await requireKlyxAdmin();

    const { data: reviews, error: reviewsError } = await supabaseAdmin
      .from("trust_decision_reviews")
      .select(
        "id, decision_id, review_kind, status, reviewer_auth_user_id, rationale, requested_at, started_at, completed_at, outcome_decision_id"
      )
      .in("status", ["requested", "in_progress"])
      .order("requested_at", { ascending: true })
      .limit(100);

    if (reviewsError) throw new Error(reviewsError.message);

    const decisionIds = (reviews ?? []).map((review) => review.decision_id);
    let decisions: Array<Record<string, unknown>> = [];

    if (decisionIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("trust_eligibility_decisions")
        .select(
          "id, account_id, policy_id, legal_assessment_id, target_type, target_ref, category_key, jurisdiction_code, decision, legal_pathway, decision_source, human_review_required, review_status, reason_codes, required_actions, explanation, created_at, expires_at"
        )
        .in("id", decisionIds);

      if (error) throw new Error(error.message);
      decisions = (data ?? []) as Array<Record<string, unknown>>;
    }

    const decisionsById = new Map(
      decisions.map((decision) => [String(decision.id), decision])
    );

    return NextResponse.json({
      reviews: (reviews ?? []).map((review) => ({
        ...review,
        decision: decisionsById.get(review.decision_id) ?? null,
      })),
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_trust_reviews_read_failed",
      route: "/api/admin/trust/reviews",
      method: "GET",
      status,
      code: "KLYX_ADMIN_TRUST_REVIEWS_READ_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const reviewer = await requireKlyxAdmin();
    const body = (await request.json()) as ReviewBody;
    const reviewId =
      typeof body.reviewId === "string" ? body.reviewId.trim() : "";
    const action =
      body.action === "start" ||
      body.action === "uphold" ||
      body.action === "replace"
        ? body.action
        : null;

    if (!reviewId || !action) {
      return NextResponse.json(
        { error: "Revue ou action invalide." },
        { status: 400 }
      );
    }

    if (action === "start") {
      const { data, error } = await supabaseAdmin
        .from("trust_decision_reviews")
        .update({
          status: "in_progress",
          reviewer_auth_user_id: reviewer.id,
          started_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .eq("status", "requested")
        .select("id, decision_id, review_kind, status, reviewer_auth_user_id, started_at")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        return NextResponse.json(
          { error: "Cette revue a déjà été prise en charge ou résolue." },
          { status: 409 }
        );
      }

      return NextResponse.json({ review: data });
    }

    const rationale =
      typeof body.rationale === "string"
        ? body.rationale.trim().slice(0, 4000)
        : "";

    if (rationale.length < 5) {
      return NextResponse.json(
        { error: "Une justification explicite est requise." },
        { status: 400 }
      );
    }

    let replacementDecision: string | null = null;
    let explanation: string | null = null;
    const reasonCodes = asStringArray(body.reasonCodes);
    const requiredActions = asRequiredActions(body.requiredActions);

    if (action === "replace") {
      replacementDecision =
        typeof body.replacementDecision === "string" &&
        REPLACEMENT_DECISIONS.has(body.replacementDecision)
          ? body.replacementDecision
          : null;
      explanation =
        typeof body.explanation === "string"
          ? body.explanation.trim().slice(0, 4000)
          : null;

      if (!replacementDecision || !explanation || explanation.length < 10) {
        return NextResponse.json(
          {
            error:
              "La nouvelle décision et une explication détaillée sont requises.",
          },
          { status: 400 }
        );
      }
    }

    const { data: outcomeDecisionId, error: rpcError } = await supabaseAdmin.rpc(
      "klyx_resolve_trust_decision_review",
      {
        p_review_id: reviewId,
        p_reviewer_auth_user_id: reviewer.id,
        p_action: action,
        p_rationale: rationale,
        p_replacement_decision: replacementDecision,
        p_reason_codes: reasonCodes,
        p_required_actions: requiredActions,
        p_explanation: explanation,
      }
    );

    if (rpcError) {
      const status = rpcErrorStatus(rpcError.message);
      return NextResponse.json(
        {
          error:
            status === 404
              ? "Revue Trust & Safety introuvable."
              : status === 409
                ? "Cette revue a déjà été résolue."
                : status === 400
                  ? "La résolution Trust & Safety est invalide."
                  : "Impossible de résoudre la revue Trust & Safety.",
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      outcomeDecisionId,
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_trust_review_update_failed",
      route: "/api/admin/trust/reviews",
      method: "PATCH",
      status,
      code: "KLYX_ADMIN_TRUST_REVIEW_UPDATE_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
    });
  }
}
