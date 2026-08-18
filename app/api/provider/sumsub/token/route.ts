import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  createSumsubSdkToken,
  sumsubConfigured,
} from "@/lib/sumsub";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    if (!sumsubConfigured()) {
      return NextResponse.json(
        {
          error:
            "Sumsub n'est pas encore configuré dans KLYX.",
        },
        { status: 503 }
      );
    }

    const { user, profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(
      profile,
      "provider"
    );

    const result =
      await createSumsubSdkToken({
        userId: profile.id,
        email: user.email ?? null,
      });

    return NextResponse.json({
      token: result.token,
      expiresIn: 600,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de démarrer la vérification.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "provider_sumsub_token_failed",
      route: "/api/provider/sumsub/token",
      method: "POST",
      status,
      code: "KLYX_PROVIDER_SUMSUB_TOKEN_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
