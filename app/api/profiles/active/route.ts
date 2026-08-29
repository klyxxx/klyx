import { NextResponse } from "next/server";

import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfile,
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
      return NextResponse.json(
        {
          error: "Non connecté.",
        },
        {
          status: 401,
        }
      );
    }

    const profiles = await getOwnedProfiles();

    if (profiles.length === 0) {
      return NextResponse.json(
        {
          profiles: [],
          activeProfileId: null,
          error: "Aucun profil KLYX associé à ce compte.",
        },
        {
          status: 404,
        }
      );
    }

    const activeProfile = await getActiveProfile();

    /*
     * KLYX_ACTIVE_PROFILE_READ_ONLY_12B_10L
     *
     * GET reste strictement en lecture seule.
     * Un GET démarré avant un changement de profil ne doit jamais
     * pouvoir terminer après le POST et réécrire l'ancien cookie.
     * Seul POST modifie ACTIVE_PROFILE_COOKIE.
     */
    return NextResponse.json({
      profiles,
      activeProfileId: activeProfile?.id ?? profiles[0].id,
    });
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
      return NextResponse.json(
        {
          error: "Non connecté.",
        },
        {
          status: 401,
        }
      );
    }

    let body: SelectProfileBody;

    try {
      body = (await request.json()) as SelectProfileBody;
    } catch {
      return NextResponse.json(
        {
          error: "Requête invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const profileId =
      typeof body.profileId === "string" ? body.profileId.trim() : "";

    if (!profileId) {
      return NextResponse.json(
        {
          error: "Identifiant de profil invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const profiles = await getOwnedProfiles();
    const profile = profiles.find((item) => item.id === profileId);

    if (!profile) {
      return NextResponse.json(
        {
          error: "Ce profil ne t’appartient pas.",
        },
        {
          status: 403,
        }
      );
    }

    const response = NextResponse.json({
      success: true,
      profileId: profile.id,
      accountType: profile.accountType,
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
