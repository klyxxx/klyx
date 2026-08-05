import { NextResponse } from "next/server";
import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfile,
  getOwnedProfiles,
} from "@/lib/active-profile";
import { createClient } from "@/lib/supabase/server";

type SelectProfileBody = {
  profileId?: unknown;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  try {
    const profiles = await getOwnedProfiles();
    const activeProfile = await getActiveProfile();
    return NextResponse.json({
      profiles,
      activeProfileId: activeProfile?.id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les profils.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

  if (typeof body.profileId !== "string" || !body.profileId) {
    return NextResponse.json(
      { error: "Identifiant de profil invalide." },
      { status: 400 }
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", body.profileId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json(
      { error: "Ce profil ne t’appartient pas." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(ACTIVE_PROFILE_COOKIE, profile.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
