import { NextResponse } from "next/server";
import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfile,
} from "@/lib/active-profile";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase/server";
import { getKlyxMarket } from "@/lib/klyx-supported-markets";

type AccountType = "client" | "provider";

type CreateProfileBody = {
  firstName?: unknown;
  lastName?: unknown;
  city?: unknown;
  countryCode?: unknown;
  accountType?: unknown;
  serviceId?: unknown;
};

type UpdateProfileBody = {
  profileId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  city?: unknown;
  countryCode?: unknown;
  avatarUrl?: unknown;
};

type DeleteProfileBody = {
  profileId?: unknown;
};

type ProfileInput = {
  firstName: string;
  lastName: string;
  city: string;
};

const AVATAR_BUCKET = "avatars";

function setActiveProfileCookie(response: NextResponse, profileId: string) {
  response.cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function readProfileInput(body: CreateProfileBody | UpdateProfileBody): ProfileInput {
  const firstName =
    typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName =
    typeof body.lastName === "string" ? body.lastName.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";

  if (!firstName || firstName.length > 60) {
    throw new Error("Le prénom est obligatoire et limité à 60 caractères.");
  }

  if (!lastName || lastName.length > 60) {
    throw new Error("Le nom est obligatoire et limité à 60 caractères.");
  }

  if (!city || city.length > 100) {
    throw new Error("La ville est obligatoire et limitée à 100 caractères.");
  }

  return { firstName, lastName, city };
}

// KLYX_PROFILE_MARKET_VALIDATION_14_21
function readProfileMarket(countryCode: unknown) {
  const normalized =
    typeof countryCode === "string"
      ? countryCode.trim().toUpperCase()
      : "";

  const market =
    getKlyxMarket(normalized);

  if (!market) {
    throw new Error(
      "KLYX_MARKET_NOT_SUPPORTED"
    );
  }

  return {
    countryCode:
      market.countryCode,
    currencyCode:
      market.currencyCode,
  };
}
function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  if (raw.includes("KLYX_MARKET_NOT_SUPPORTED")) {
    return "Ce pays n’est pas encore pris en charge par KLYX.";
  }

  if (raw.includes("KLYX_PROFILE_LIMIT_REACHED")) {
    return "Tu peux enregistrer au maximum cinq profils KLYX.";
  }

  if (raw.includes("KLYX_SERVICE_REQUIRED")) {
    return "Choisis le premier service proposé par ce prestataire.";
  }

  if (raw.includes("KLYX_SERVICE_NOT_FOUND")) {
    return "Le service sélectionné n’existe plus.";
  }

  if (raw.includes("KLYX_NOT_AUTHENTICATED")) {
    return "Non connecté.";
  }

  if (raw.includes("KLYX_INVALID_")) {
    return "Les informations du profil sont invalides.";
  }

  return raw || "Une erreur inattendue est survenue.";
}

async function authenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("services")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Impossible de charger les services KLYX." },
      { status: 500 }
    );
  }

  return NextResponse.json({ services: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  let body: CreateProfileBody;

  try {
    body = (await request.json()) as CreateProfileBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const profileInput = readProfileInput(body);
    const marketInput = readProfileMarket(body.countryCode);

    const accountType: AccountType | null =
      body.accountType === "client" || body.accountType === "provider"
        ? body.accountType
        : null;

    if (!accountType) {
      return NextResponse.json(
        { error: "Choisis Client ou Prestataire." },
        { status: 400 }
      );
    }

    const serviceId =
      typeof body.serviceId === "string" && body.serviceId
        ? body.serviceId
        : null;

    if (accountType === "provider" && !serviceId) {
      return NextResponse.json(
        { error: "Choisis le premier service du prestataire." },
        { status: 400 }
      );
    }

    const { data: profileId, error } = await supabase.rpc(
      "klyx_create_profile",
      {
        p_first_name: profileInput.firstName,
        p_last_name: profileInput.lastName,
        p_city: profileInput.city,
        p_account_type: accountType,
        p_service_id: accountType === "provider" ? serviceId : null,
      }
    );

    if (error || typeof profileId !== "string") {
      throw new Error(error?.message ?? "Le profil n’a pas été créé.");
    }

    // KLYX_PROFILE_MARKET_WRITE_14_21
    const {
      error: marketWriteError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        country_code:
          marketInput.countryCode,
        currency_code:
          marketInput.currencyCode,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("owner_user_id", user.id);

    if (marketWriteError) {
      throw new Error(
        marketWriteError.message
      );
    }

    const response = NextResponse.json({ profileId }, { status: 201 });
    setActiveProfileCookie(response, profileId);
    return response;
  } catch (error) {
    const message = errorMessage(error);
    const status = message === "Non connecté." ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const { supabase, user } = await authenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  let body: UpdateProfileBody;

  try {
    body = (await request.json()) as UpdateProfileBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (typeof body.profileId !== "string" || !body.profileId) {
    return NextResponse.json(
      { error: "Profil invalide." },
      { status: 400 }
    );
  }

  try {
    const profileInput = readProfileInput(body);
    const marketInput = readProfileMarket(body.countryCode);

    const updatePayload: Record<string, string | null> = {
      first_name: profileInput.firstName,
      last_name: profileInput.lastName,
      full_name: `${profileInput.firstName} ${profileInput.lastName}`,
      city: profileInput.city,
      country_code:
        marketInput.countryCode,
      currency_code:
        marketInput.currencyCode,
      updated_at: new Date().toISOString(),
    };

    if (body.avatarUrl === null) {
      updatePayload.avatar_url = null;
    } else if (typeof body.avatarUrl === "string") {
      const avatarUrl = body.avatarUrl.trim();

      if (avatarUrl) {
        const parsedUrl = new URL(avatarUrl);
        if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
          throw new Error("Adresse de photo invalide.");
        }
        updatePayload.avatar_url = avatarUrl;
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", body.profileId)
      .eq("owner_user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { supabase, user } = await authenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  let body: DeleteProfileBody;

  try {
    body = (await request.json()) as DeleteProfileBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (typeof body.profileId !== "string" || !body.profileId) {
    return NextResponse.json(
      { error: "Profil invalide." },
      { status: 400 }
    );
  }

  const { data: ownedProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    return NextResponse.json(
      { error: "Impossible de vérifier les profils." },
      { status: 500 }
    );
  }

  const targetBelongsToUser = ownedProfiles?.some(
    (profile) => profile.id === body.profileId
  );

  if (!targetBelongsToUser) {
    return NextResponse.json(
      { error: "Ce profil ne t’appartient pas." },
      { status: 403 }
    );
  }

  if (!ownedProfiles || ownedProfiles.length <= 1) {
    return NextResponse.json(
      { error: "Le dernier profil KLYX ne peut pas être supprimé." },
      { status: 400 }
    );
  }

  const activeProfile = await getActiveProfile();
  const replacementProfileId =
    activeProfile?.id === body.profileId
      ? ownedProfiles.find((profile) => profile.id !== body.profileId)?.id
      : activeProfile?.id;

  const { error: deleteError } = await supabase.rpc("klyx_delete_profile", {
    p_profile_id: body.profileId,
  });

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          "Ce profil contient encore des réservations ou des données à conserver. Supprime d’abord son activité.",
      },
      { status: 409 }
    );
  }

  const { data: avatarObjects } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .list(body.profileId, { limit: 100 });

  const storedAvatarObjects = (avatarObjects ?? []) as Array<{ name: string }>;

  if (storedAvatarObjects.length > 0) {
    await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .remove(
        storedAvatarObjects.map((object) => `${body.profileId}/${object.name}`)
      );
  }

  const response = NextResponse.json({ success: true });
  if (replacementProfileId) {
    setActiveProfileCookie(response, replacementProfileId);
  }
  return response;
}
