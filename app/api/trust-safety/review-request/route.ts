import { NextResponse } from "next/server";
import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const ratePolicy = API_RATE_LIMIT_POLICIES.trustSafetyReviewRequest;
    const rateLimit = await consumeApiRateLimit(profile.id, ratePolicy);
    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(ratePolicy, rateLimit);
    }
    const headers = rateLimitResponseHeaders(ratePolicy, rateLimit);

    const body = (await request.json()) as {
      restrictionId?: unknown;
      note?: unknown;
    };
    const restrictionId =
      typeof body.restrictionId === "string"
        ? body.restrictionId.trim()
        : "";
    const note =
      typeof body.note === "string"
        ? body.note.trim().slice(0, 4000)
        : "";

    if (!restrictionId) {
      return NextResponse.json(
        { error: "Restriction is required." },
        { status: 400, headers }
      );
    }
    if (note.length < 20) {
      return NextResponse.json(
        { error: "Explain the review request with at least 20 characters." },
        { status: 400, headers }
      );
    }

    const { data: restriction, error: readError } = await supabaseAdmin
      .from("trust_safety_restrictions")
      .select("id, profile_id, status, review_status")
      .eq("id", restrictionId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!restriction) {
      return NextResponse.json(
        { error: "Restriction not found." },
        { status: 404, headers }
      );
    }
    if (!["active", "under_review"].includes(restriction.status)) {
      return NextResponse.json(
        { error: "This restriction is no longer active." },
        { status: 409, headers }
      );
    }
    if (restriction.review_status === "pending") {
      return NextResponse.json(
        { error: "A human review is already pending." },
        { status: 409, headers }
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("trust_safety_restrictions")
      .update({
        status: "under_review",
        review_status: "pending",
        review_requested_at: now,
        review_request_note: note,
        updated_at: now,
      })
      .eq("id", restriction.id)
      .eq("profile_id", profile.id);
    if (updateError) throw new Error(updateError.message);

    const { error: auditError } = await supabaseAdmin
      .from("trust_safety_audit_events")
      .insert({
        subject_profile_id: profile.id,
        actor_profile_id: profile.id,
        event_type: "restriction_review_requested",
        object_type: "trust_safety_restriction",
        object_id: restriction.id,
        reason_codes: ["HUMAN_REVIEW_REQUESTED"],
        detail: { note },
      });
    if (auditError) throw new Error(auditError.message);

    return NextResponse.json(
      {
        restrictionId: restriction.id,
        reviewStatus: "pending",
        message:
          "Human review requested. The prior decision remains traceable and reviewable.",
      },
      { headers }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to request human review.";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "trust_safety_review_request_failed",
      route: "/api/trust-safety/review-request",
      method: "POST",
      code: "KLYX_TRUST_SAFETY_REVIEW_REQUEST_FAILED",
      status,
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
