import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const ACTIVE_PROFILE_COOKIE =
  "klyx_active_profile";

export type AccountType =
  | "client"
  | "provider";

export type ActiveProfile = {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string | null;
  currencyCode: string | null;
  accountType: AccountType;
  avatarUrl: string | null;
};

type ProfileRow = {
  id: string;
  owner_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  country_code: string | null;
  currency_code: string | null;
  account_type: string | null;
  avatar_url: string | null;
};

function normalizeProfile(
  profile: ProfileRow,
  fallbackOwnerUserId: string
): ActiveProfile {
  return {
    id: profile.id,

    ownerUserId:
      profile.owner_user_id ??
      fallbackOwnerUserId,

    firstName:
      profile.first_name ?? "",

    lastName:
      profile.last_name ?? "",

    city:
      profile.city ?? "",

    countryCode:
      profile.country_code ?? null,

    currencyCode:
      profile.currency_code ?? null,

    accountType:
      profile.account_type ===
      "provider"
        ? "provider"
        : "client",

    avatarUrl:
      profile.avatar_url ?? null,
  };
}

async function authenticatedUser() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getOwnedProfiles(): Promise<
  ActiveProfile[]
> {
  const user =
    await authenticatedUser();

  if (!user) {
    return [];
  }

  /*
   * ARCHITECTURE MODERNE
   *
   * Tous les profils appartenant
   * au compte Supabase.
   */
  const {
    data: ownedData,
    error: ownedError,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      `
      id,
      owner_user_id,
      first_name,
      last_name,
      city,
      country_code,
      currency_code,
      account_type,
      avatar_url
      `
    )
    .eq(
      "owner_user_id",
      user.id
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (ownedError) {
    throw new Error(
      ownedError.message
    );
  }

  const ownedProfiles =
    (ownedData ??
      []) as ProfileRow[];

  if (
    ownedProfiles.length > 0
  ) {
    return ownedProfiles.map(
      (profile) =>
        normalizeProfile(
          profile,
          user.id
        )
    );
  }

  /*
   * COMPATIBILITE ANCIEN KLYX
   *
   * Les premières versions
   * utilisaient parfois :
   *
   * profiles.id = auth.users.id
   *
   * sans owner_user_id.
   *
   * On recherche uniquement
   * CE cas très précis.
   */
  const {
    data: legacyProfile,
    error: legacyError,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      `
      id,
      owner_user_id,
      first_name,
      last_name,
      city,
      country_code,
      currency_code,
      account_type,
      avatar_url
      `
    )
    .eq("id", user.id)
    .maybeSingle();

  if (legacyError) {
    throw new Error(
      legacyError.message
    );
  }

  if (!legacyProfile) {
    return [];
  }

  /*
   * Migration automatique
   * et sûre de l'ancien profil.
   *
   * On ne répare que le profil
   * dont l'ID correspond
   * exactement au user Auth.
   */
  if (
    !legacyProfile.owner_user_id
  ) {
    const {
      error: repairError,
    } = await supabaseAdmin
      .from("profiles")
      .update({
        owner_user_id:
          user.id,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        legacyProfile.id
      );

    if (repairError) {
      throw new Error(
        repairError.message
      );
    }

    legacyProfile.owner_user_id =
      user.id;
  }

  return [
    normalizeProfile(
      legacyProfile as ProfileRow,
      user.id
    ),
  ];
}

export async function getActiveProfile(): Promise<
  ActiveProfile | null
> {
  const profiles =
    await getOwnedProfiles();

  if (
    profiles.length === 0
  ) {
    return null;
  }

  const cookieStore =
    await cookies();

  const selectedId =
    cookieStore
      .get(
        ACTIVE_PROFILE_COOKIE
      )
      ?.value
      ?.trim();

  if (selectedId) {
    const selectedProfile =
      profiles.find(
        (profile) =>
          profile.id ===
          selectedId
      );

    if (selectedProfile) {
      return selectedProfile;
    }
  }

  /*
   * Cookie absent ou ancien :
   * on utilise automatiquement
   * le premier profil du compte.
   */
  return profiles[0];
}