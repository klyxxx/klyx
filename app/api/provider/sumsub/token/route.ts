import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { getKlyxIdentityVerificationAdapter } from "@/lib/providers/runtime-adapters";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const identityVerification =
      await getKlyxIdentityVerificationAdapter();

    if (!identityVerification.configured()) {
      return NextResponse.json(
        {
          error:
            "La vérification d'identité externe n'est pas encore configurée dans KLYX.",
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
      await identityVerification.createSdkToken({
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
