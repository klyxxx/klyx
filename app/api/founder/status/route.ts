import { NextResponse } from "next/server";
import { founderErrorStatus, requireKlyxFounder } from "@/lib/founder-auth";
import { getActiveProfile, getOwnedProfiles } from "@/lib/active-profile";

export async function GET() {
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
    return NextResponse.json(
      {
        isFounder: false,
        error: error instanceof Error ? error.message : "Accès Founder refusé.",
      },
      { status: founderErrorStatus(error) }
    );
  }
}
