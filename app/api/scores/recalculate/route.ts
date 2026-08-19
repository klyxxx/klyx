import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";
import { recalculateProviderScores } from "@/lib/provider-score";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const result =
      await recalculateProviderScores(
        profile.id
      );

    return NextResponse.json({
      ...result,
      updated: result.updatedServices,
      message:
        result.updatedServices > 0
          ? "Ton KLYX Score a été recalculé."
          : "Aucun service prestataire actif à recalculer.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de recalculer le KLYX Score.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "provider_score_recalculate_failed",
      route: "/api/scores/recalculate",
      method: "POST",
      code: "provider_score_recalculate_failed",
      status,
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}
