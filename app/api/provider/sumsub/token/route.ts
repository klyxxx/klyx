import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  createSumsubSdkToken,
  sumsubConfigured,
} from "@/lib/sumsub";

export async function POST(request: Request) {
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

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
