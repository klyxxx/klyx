import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const {
      user,
      account,
      profiles,
      canonicalProfile,
    } = await getAuthenticatedAccount(request);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email ?? null,
        },
        account: {
          id: account.id,
          canRequestServices: account.canRequestServices,
          canOfferServices: account.canOfferServices,
          capabilitySource: account.capabilitySource,
          enabledCapabilities: account.enabledCapabilities,
        },
        profiles: profiles.map((profile) => ({
          id: profile.id,
          accountType: profile.accountType,
          canRequestServices: profile.canRequestServices,
          canOfferServices: profile.canOfferServices,
          firstName: profile.firstName,
          lastName: profile.lastName,
          countryCode: profile.countryCode,
          currencyCode: profile.currencyCode,
        })),
        canonicalProfileId: canonicalProfile.id,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return secureApiErrorResponse({
      error,
      event: "mobile_bootstrap_failed",
      route: "/api/mobile/bootstrap",
      method: "GET",
      status: apiErrorStatus(message),
      code: "KLYX_MOBILE_BOOTSTRAP_FAILED",
      startedAt,
    });
  }
}
