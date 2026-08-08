import {
  NextResponse,
} from "next/server";

import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfile,
  getOwnedProfiles,
} from "@/lib/active-profile";

import {
  createClient,
} from "@/lib/supabase/server";

type SelectProfileBody = {
  profileId?: unknown;
};

function setActiveProfileCookie(
  response: NextResponse,
  profileId: string
) {
  response.cookies.set(
    ACTIVE_PROFILE_COOKIE,
    profileId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        60 *
        60 *
        24 *
        365,
    }
  );
}

export async function GET() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Non connecté.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const profiles =
      await getOwnedProfiles();

    if (
      profiles.length === 0
    ) {
      return NextResponse.json(
        {
          profiles: [],
          activeProfileId: null,
          error:
            "Aucun profil KLYX associé à ce compte.",
        },
        {
          status: 404,
        }
      );
    }

    const activeProfile =
      await getActiveProfile();

    const response =
      NextResponse.json({
        profiles,
        activeProfileId:
          activeProfile?.id ??
          profiles[0].id,
      });

    /*
     * Répare aussi le cookie
     * automatiquement.
     */
    const resolvedProfileId =
      activeProfile?.id ??
      profiles[0].id;

    setActiveProfileCookie(
      response,
      resolvedProfileId
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les profils.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Non connecté.",
      },
      {
        status: 401,
      }
    );
  }

  let body: SelectProfileBody;

  try {
    body =
      (await request.json()) as SelectProfileBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "Requête invalide.",
      },
      {
        status: 400,
      }
    );
  }

  const profileId =
    typeof body.profileId ===
      "string"
      ? body.profileId.trim()
      : "";

  if (!profileId) {
    return NextResponse.json(
      {
        error:
          "Identifiant de profil invalide.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    /*
     * On charge les profils
     * autorisés côté serveur.
     *
     * Cela fonctionne aussi
     * après migration automatique
     * d'un ancien profil.
     */
    const profiles =
      await getOwnedProfiles();

    const profile =
      profiles.find(
        (item) =>
          item.id ===
          profileId
      );

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Ce profil ne t’appartient pas.",
        },
        {
          status: 403,
        }
      );
    }

    const response =
      NextResponse.json({
        success: true,
        profileId:
          profile.id,
      });

    setActiveProfileCookie(
      response,
      profile.id
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de changer de profil.",
      },
      {
        status: 500,
      }
    );
  }
}