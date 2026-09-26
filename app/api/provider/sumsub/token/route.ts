import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { getKlyxIdentityVerificationProvider } from "@/lib/providers/registry.server";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const identityProvider = getKlyxIdentityVerificationProvider();

    if (!identityProvider.getStatus().configured) {
      return NextResponse.json(
        {
          error:
            "Le fournisseur de vérification d'identité n'est pas encore configuré dans KLYX.",
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
      await identityProvider.createSessionToken({
        subjectId: profile.id,
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
      event: "provider_identity_token_failed",
      route: "/api/provider/sumsub/token",
      method: "POST",
      status,
      code: "KLYX_PROVIDER_IDENTITY_TOKEN_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
