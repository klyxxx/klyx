import { NextResponse } from "next/server";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { getActiveProfile, getOwnedProfiles } from "@/lib/active-profile";

export async function GET() {
  const startedAt = Date.now();

  try {
    const user = await requireKlyxFounder();
    const profiles = await getOwnedProfiles();
    const activeProfile = await getActiveProfile();

    return NextResponse.json({
      isFounder: true,
      email: user.email ?? null,
      activeProfileId: activeProfile?.id ?? null,
      profiles,
      clientProfiles: profiles.filter((p) => p.accountType === "client"),
      providerProfiles: profiles.filter((p) => p.accountType === "provider"),
      capabilities: {
        adminMode: true,
        sumsubMode: "pending_external",
      },
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_status_failed",
      route: "/api/founder/status",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_STATUS_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
      details: {
        isFounder: false,
      },
    });
  }
}
