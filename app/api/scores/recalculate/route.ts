import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { recalculateProviderScores } from "@/lib/provider-score";

export async function POST(request: Request) {
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

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
