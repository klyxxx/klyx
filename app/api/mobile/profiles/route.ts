import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { apiErrorStatus, getAuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ACTIVE_PROFILE_HEADER = "x-klyx-active-profile-id";

type SelectProfileBody = {
  profileId?: unknown;
};

type ProfileDisplayRow = {
  id: string;
  city: string | null;
  avatar_url: string | null;
};

function requestedProfileId(request: Request): string {
  return request.headers.get(ACTIVE_PROFILE_HEADER)?.trim() ?? "";
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { user, profile, profiles } = await getAuthenticatedProfile(request);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, city, avatar_url")
      .eq("owner_user_id", user.id);

    if (error) throw new Error(error.message);

    const displayById = new Map(
      ((data ?? []) as ProfileDisplayRow[]).map((row) => [row.id, row])
    );
    const requested = requestedProfileId(request);
    const activeProfileId = profiles.some((item) => item.id === requested)
      ? requested
      : profile.id;

    return NextResponse.json(
      {
        profiles: profiles.map((item) => {
          const display = displayById.get(item.id);
          return {
            id: item.id,
            ownerUserId: item.ownerUserId,
            firstName: item.firstName,
            lastName: item.lastName,
            city: display?.city ?? "",
            countryCode: item.countryCode || null,
            currencyCode: item.currencyCode || null,
            accountType: item.accountType,
            canRequestServices: item.canRequestServices,
            canOfferServices: item.canOfferServices,
            avatarUrl: display?.avatar_url ?? null,
          };
        }),
        activeProfileId,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return secureApiErrorResponse({
      error,
      event: "mobile_profiles_load_failed",
      route: "/api/mobile/profiles",
      method: "GET",
      status: apiErrorStatus(message),
      code: "KLYX_MOBILE_PROFILES_LOAD_FAILED",
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profiles } = await getAuthenticatedProfile(request);
    let body: SelectProfileBody;

    try {
      body = (await request.json()) as SelectProfileBody;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide.", code: "KLYX_MOBILE_PROFILE_INVALID_JSON" },
        { status: 400 }
      );
    }

    const profileId =
      typeof body.profileId === "string" ? body.profileId.trim() : "";
    const selected = profiles.find((item) => item.id === profileId);

    if (!selected) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas.", code: "KLYX_MOBILE_PROFILE_FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        profileId: selected.id,
        accountType: selected.accountType,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return secureApiErrorResponse({
      error,
      event: "mobile_profile_select_failed",
      route: "/api/mobile/profiles",
      method: "POST",
      status: apiErrorStatus(message),
      code: "KLYX_MOBILE_PROFILE_SELECT_FAILED",
      startedAt,
    });
  }
}
