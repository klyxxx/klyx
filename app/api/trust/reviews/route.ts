import { NextResponse } from "next/server";

import { apiErrorStatus } from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  getAuthenticatedTrustAccount,
  requestTrustDecisionReview,
} from "@/lib/trust-safety/server";
import type { TrustReviewKind } from "@/lib/trust-safety/application-contract";

type ReviewBody = {
  decisionId?: unknown;
  reviewKind?: unknown;
};

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { accountId } = await getAuthenticatedTrustAccount(request);
    const body = (await request.json()) as ReviewBody;
    const decisionId =
      typeof body.decisionId === "string" ? body.decisionId.trim() : "";
    const reviewKind: TrustReviewKind | null =
      body.reviewKind === "appeal" || body.reviewKind === "human_review"
        ? body.reviewKind
        : body.reviewKind == null
          ? "human_review"
          : null;

    if (!decisionId || !reviewKind) {
      return NextResponse.json(
        { error: "Décision ou type de revue invalide." },
        { status: 400 }
      );
    }

    const result = await requestTrustDecisionReview({
      accountId,
      decisionId,
      reviewKind,
    });

    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "KLYX_TRUST_DECISION_NOT_FOUND") {
      return NextResponse.json(
        { error: "Décision Trust & Safety introuvable." },
        { status: 404 }
      );
    }

    if (message === "KLYX_TRUST_REVIEW_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "Aucune revue n’est disponible pour cette décision." },
        { status: 409 }
      );
    }

    if (message === "KLYX_TRUST_REVIEW_ALREADY_COMPLETED") {
      return NextResponse.json(
        { error: "Cette décision a déjà fait l’objet de cette revue." },
        { status: 409 }
      );
    }

    const status =
      message === "KLYX_TRUST_ACCOUNT_REQUIRED"
        ? 403
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "trust_review_request_failed",
      route: "/api/trust/reviews",
      method: "POST",
      status,
      code: "KLYX_TRUST_REVIEW_REQUEST_FAILED",
      startedAt,
    });
  }
}
