import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACTIVE_PROFILE_COOKIE,
  getOwnedProfiles,
} from "@/lib/active-profile";
import { secureApiErrorResponse } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";

type SelectProfileBody = {
  profileId?: unknown;
};

function setActiveProfileCookie(
  response: NextResponse,
  profileId: string
) {
  response.cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const profiles = await getOwnedProfiles();

    if (profiles.length === 0) {
      return NextResponse.json(
        {
          profiles: [],
          activeProfileId: null,
          error: "Aucun profil KLYX associé à ce compte.",
        },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();
    const selectedProfileId =
      cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value?.trim() ?? "";
    const activeProfileId =
      selectedProfileId &&
      profiles.some((profile) => profile.id === selectedProfileId)
        ? selectedProfileId
        : null;

    /* KLYX_ACTIVE_PROFILE_READ_ONLY_12B_10L */
    return NextResponse.json({ profiles, activeProfileId });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profiles_active_load_failed",
      route: "/api/profiles/active",
      method: "GET",
      status: 500,
      code: "KLYX_PROFILES_ACTIVE_LOAD_FAILED",
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    let body: SelectProfileBody;

    try {
      body = (await request.json()) as SelectProfileBody;
    } catch {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const profileId =
      typeof body.profileId === "string" ? body.profileId.trim() : "";

    if (!profileId) {
      return NextResponse.json(
        { error: "Identifiant de profil invalide." },
        { status: 400 }
      );
    }

    const profiles = await getOwnedProfiles();
    const profile = profiles.find((item) => item.id === profileId);

    if (!profile) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas." },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      profileId: profile.id,
      // Legacy field remains for old consumers during the migration.
      accountType: profile.accountType,
      canRequestServices: profile.canRequestServices,
      canOfferServices: profile.canOfferServices,
      capabilitySource: profile.capabilitySource,
    });

    setActiveProfileCookie(response, profile.id);
    return response;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "profiles_active_switch_failed",
      route: "/api/profiles/active",
      method: "POST",
      status: 500,
      code: "KLYX_PROFILES_ACTIVE_SWITCH_FAILED",
      startedAt,
    });
  }
}
