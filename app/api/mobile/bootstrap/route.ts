import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";

const ROUTE = "/api/mobile/bootstrap";

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { account, profile, profiles, canonicalProfile, user } =
      await getAuthenticatedProfile(request);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      account: {
        id: account.id,
        canRequestServices: account.canRequestServices,
        canOfferServices: account.canOfferServices,
        enabledCapabilities: account.enabledCapabilities,
      },
      activeProfileId: profile.id,
      canonicalProfileId: canonicalProfile.id,
      profiles: profiles.map((item) => ({
        id: item.id,
        accountType: item.accountType,
        legacyAccountType: item.legacyAccountType,
        canRequestServices: item.canRequestServices,
        canOfferServices: item.canOfferServices,
        firstName: item.firstName,
        lastName: item.lastName,
        countryCode: item.countryCode,
        currencyCode: item.currencyCode,
      })),
      clientContract: {
        authority: "klyx_core",
        bearerAuth: "supabase_access_token",
        financialAuthorityOnClient: false,
        eligibilityAuthorityOnClient: false,
        ledgerAuthorityOnClient: false,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bootstrap mobile indisponible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "mobile_bootstrap_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_MOBILE_BOOTSTRAP_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
