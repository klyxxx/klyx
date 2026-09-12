import "server-only";

import { getAuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  canRequestTrustReview,
  redactTrustDecision,
  type TrustDecisionRow,
  type TrustReviewKind,
} from "@/lib/trust-safety/application-contract";

const TRUST_DECISION_SELECT =
  "id, target_type, target_ref, category_key, jurisdiction_code, decision, legal_pathway, human_review_required, review_status, reason_codes, required_actions, explanation, created_at, expires_at";

export async function getAuthenticatedTrustAccount(request: Request) {
  const auth = await getAuthenticatedProfile(request);

  const { data: account, error } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!account) throw new Error("KLYX_TRUST_ACCOUNT_REQUIRED");

  return {
    ...auth,
    accountId: account.id as string,
  };
}

export async function listTrustDecisions(params: {
  accountId: string;
  targetType?: string | null;
  targetRef?: string | null;
  categoryKey?: string | null;
  jurisdictionCode?: string | null;
  limit?: number;
}) {
  let query = supabaseAdmin
    .from("trust_eligibility_decisions")
    .select(TRUST_DECISION_SELECT)
    .eq("account_id", params.accountId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(params.limit ?? 10, 1), 20));

  if (params.targetType) query = query.eq("target_type", params.targetType);
  if (params.targetRef) query = query.eq("target_ref", params.targetRef);
  if (params.categoryKey) query = query.eq("category_key", params.categoryKey);
  if (params.jurisdictionCode) {
    query = query.eq("jurisdiction_code", params.jurisdictionCode);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as TrustDecisionRow[]).map(redactTrustDecision);
}

export async function requestTrustDecisionReview(params: {
  accountId: string;
  decisionId: string;
  reviewKind: TrustReviewKind;
}) {
  const { data: decision, error: decisionError } = await supabaseAdmin
    .from("trust_eligibility_decisions")
    .select(TRUST_DECISION_SELECT)
    .eq("id", params.decisionId)
    .eq("account_id", params.accountId)
    .maybeSingle();

  if (decisionError) throw new Error(decisionError.message);
  if (!decision) throw new Error("KLYX_TRUST_DECISION_NOT_FOUND");

  if (!canRequestTrustReview(decision as TrustDecisionRow, params.reviewKind)) {
    throw new Error("KLYX_TRUST_REVIEW_NOT_AVAILABLE");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("trust_decision_reviews")
    .select("id, decision_id, review_kind, status, requested_at")
    .eq("decision_id", params.decisionId)
    .eq("review_kind", params.reviewKind)
    .in("status", ["requested", "in_progress"])
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return { review: existing, created: false };

  const { data: review, error: createError } = await supabaseAdmin
    .from("trust_decision_reviews")
    .insert({
      decision_id: params.decisionId,
      review_kind: params.reviewKind,
      requested_by_account_id: params.accountId,
      status: "requested",
    })
    .select("id, decision_id, review_kind, status, requested_at")
    .single();

  if (createError?.code === "23505") {
    const { data: racedReview, error: racedError } = await supabaseAdmin
      .from("trust_decision_reviews")
      .select("id, decision_id, review_kind, status, requested_at")
      .eq("decision_id", params.decisionId)
      .eq("review_kind", params.reviewKind)
      .in("status", ["requested", "in_progress"])
      .maybeSingle();

    if (racedError) throw new Error(racedError.message);
    if (racedReview) return { review: racedReview, created: false };
  }

  if (createError) throw new Error(createError.message);

  return { review, created: true };
}
