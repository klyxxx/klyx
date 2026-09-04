import { after, NextResponse } from "next/server";

import {
  ACTIVE_PROFILE_COOKIE,
  getActiveProfile,
} from "@/lib/active-profile";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  accountCreatedEmail,
  profileCreatedEmail,
  profileDeletedEmail,
} from "@/lib/email/lifecycle-templates";
import { sendKlyxTransactionalEmail } from "@/lib/email/resend";
import { getKlyxMarket } from "@/lib/klyx-supported-markets";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase/server";

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

type SafeProfileError = {
  status: number;
  publicMessage: string;
};

const AVATAR_BUCKET = "avatars";

const SAFE_PROFILE_INPUT_MESSAGES = new Set([
  "Le prénom est obligatoire et limité à 60 caractères.",
  "Le nom est obligatoire et limité à 60 caractères.",
  "La ville est obligatoire et limitée à 100 caractères.",
  "Adresse de photo invalide.",
]);

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

function readProfileMarket(countryCode: unknown) {
  const normalized =
    typeof countryCode === "string"
      ? countryCode.trim().toUpperCase()
      : "";

  const market = getKlyxMarket(normalized);

  if (!market) {
    throw new Error("KLYX_MARKET_NOT_SUPPORTED");
  }

  return {
    countryCode: market.countryCode,
    currencyCode: market.currencyCode,
  };
}

function safeProfileError(error: unknown): SafeProfileError | null {
  const raw =
    error instanceof Error
      ? error.message
      : String(error ?? "");

  if (SAFE_PROFILE_INPUT_MESSAGES.has(raw)) {
    return {
      status: 400,
      publicMessage: raw,
    };
  }

  if (raw.includes("KLYX_MARKET_NOT_SUPPORTED")) {
    return {
      status: 400,
      publicMessage: "Ce pays n’est pas encore pris en charge par KLYX.",
    };
  }

  if (raw.includes("KLYX_PROFILE_LIMIT_REACHED")) {
    return {
      status: 400,
      publicMessage: "Tu peux enregistrer au maximum cinq profils KLYX.",
    };
  }

  if (raw.includes("KLYX_SERVICE_REQUIRED")) {
    return {
      status: 400,
      publicMessage: "Choisis le premier service proposé par ce prestataire.",
    };
  }

  if (raw.includes("KLYX_SERVICE_NOT_FOUND")) {
    return {
      status: 400,
      publicMessage: "Le service sélectionné n’existe plus.",
    };
  }

  if (raw.includes("KLYX_NOT_AUTHENTICATED")) {
    return {
      status: 401,
      publicMessage: "Non connecté.",
    };
  }

  if (raw.includes("KLYX_INVALID_")) {
    return {
      status: 400,
      publicMessage: "Les informations du profil sont invalides.",
    };
  }

  return null;
}

function secureProfileManageError(
  error: unknown,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  event: string,
  code: string,
  startedAt: number
) {
  const safe = safeProfileError(error);

  return secureApiErrorResponse({
    error,
    event,
    route: "/api/profiles/manage",
    method,
    status: safe?.status ?? 500,
    code,
    publicMessage: safe?.publicMessage,
    startedAt,
  });
}

async function authenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const { supabase, user } = await authenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("services")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (error) {
    return secureProfileManageError(
      error,
      "GET",
      "profiles_manage_services_load_failed",
      "KLYX_PROFILES_MANAGE_SERVICES_LOAD_FAILED",
      startedAt
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
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

    const { count: existingProfileCount, error: profileCountError } =
      await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", user.id);

    if (profileCountError) {
      throw profileCountError;
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

    if (error) {
      throw error;
    }

    if (typeof profileId !== "string") {
      throw new Error("KLYX_INVALID_PROFILE_CREATION_RESULT");
    }

    const { error: marketWriteError } = await supabaseAdmin
      .from("profiles")
      .update({
        country_code: marketInput.countryCode,
        currency_code: marketInput.currencyCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("owner_user_id", user.id);

    if (marketWriteError) {
      throw marketWriteError;
    }

    const userEmail = user.email?.trim();

    if (userEmail) {
      const content =
        (existingProfileCount ?? 0) === 0
          ? accountCreatedEmail({
              firstName: profileInput.firstName,
              accountType,
            })
          : profileCreatedEmail(accountType);

      after(async () => {
        await sendKlyxTransactionalEmail({
          to: userEmail,
          ...content,
        });
      });
    }

    const response = NextResponse.json({ profileId }, { status: 201 });
    setActiveProfileCookie(response, profileId);
    return response;
  } catch (error) {
    return secureProfileManageError(
      error,
      "POST",
      "profiles_manage_create_failed",
      "KLYX_PROFILES_MANAGE_CREATE_FAILED",
      startedAt
    );
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const { user } = await authenticatedUser();

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

    const profileInput = readProfileInput(body);
    const marketInput = readProfileMarket(body.countryCode);

    const updatePayload: Record<string, string | null> = {
      first_name: profileInput.firstName,
      last_name: profileInput.lastName,
      full_name: `${profileInput.firstName} ${profileInput.lastName}`,
      city: profileInput.city,
      country_code: marketInput.countryCode,
      currency_code: marketInput.currencyCode,
      updated_at: new Date().toISOString(),
    };

    if (body.avatarUrl === null) {
      updatePayload.avatar_url = null;
    } else if (typeof body.avatarUrl === "string") {
      const avatarUrl = body.avatarUrl.trim();

      if (avatarUrl) {
        let parsedUrl: URL;

        try {
          parsedUrl = new URL(avatarUrl);
        } catch {
          throw new Error("Adresse de photo invalide.");
        }

        if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
          throw new Error("Adresse de photo invalide.");
        }
        updatePayload.avatar_url = avatarUrl;
      }
    }

    // KLYX_PROFILE_SERVER_BOUNDARY_12B_12G
    // Authentication comes from the user session; the owned profile write
    // itself stays server-side so browser roles need no direct UPDATE grant.
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", body.profileId)
      .eq("owner_user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return secureProfileManageError(
      error,
      "PATCH",
      "profiles_manage_update_failed",
      "KLYX_PROFILES_MANAGE_UPDATE_FAILED",
      startedAt
    );
  }
}

export async function DELETE(request: Request) {
  const startedAt = Date.now();

  try {
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

    const { data: ownedProfiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });

    if (profilesError) {
      throw profilesError;
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
      return secureApiErrorResponse({
        error: deleteError,
        event: "profiles_manage_delete_conflict",
        route: "/api/profiles/manage",
        method: "DELETE",
        status: 409,
        code: "KLYX_PROFILES_MANAGE_DELETE_CONFLICT",
        publicMessage:
          "Ce profil contient encore des réservations ou des données à conserver. Supprime d’abord son activité.",
        startedAt,
      });
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

    const userEmail = user.email?.trim();

    if (userEmail) {
      after(async () => {
        await sendKlyxTransactionalEmail({
          to: userEmail,
          ...profileDeletedEmail(),
        });
      });
    }

    const response = NextResponse.json({ success: true });
    if (replacementProfileId) {
      setActiveProfileCookie(response, replacementProfileId);
    }
    return response;
  } catch (error) {
    return secureProfileManageError(
      error,
      "DELETE",
      "profiles_manage_delete_failed",
      "KLYX_PROFILES_MANAGE_DELETE_FAILED",
      startedAt
    );
  }
}
