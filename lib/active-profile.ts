import "server-only";

import { cookies } from "next/headers";

import {
  normalizeLegacyAccountType,
  resolveProfileCapabilityState,
  type LegacyAccountType,
  type ProfileCapabilitySource,
} from "@/lib/profile-actor-capabilities";
import { loadProfileCapabilityStates } from "@/lib/profile-actor-capabilities-server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

// Backward-compatible discriminator. New authorization must prefer the
// independent capability booleans below.
export type AccountType = LegacyAccountType;

export type ActiveProfile = {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string | null;
  currencyCode: string | null;
  accountType: AccountType;
  canRequestServices: boolean;
  canOfferServices: boolean;
  capabilitySource: ProfileCapabilitySource;
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
  fallbackOwnerUserId: string,
  capabilityState = resolveProfileCapabilityState(
    normalizeLegacyAccountType(profile.account_type),
    []
  )
): ActiveProfile {
  return {
    id: profile.id,
    ownerUserId: profile.owner_user_id ?? fallbackOwnerUserId,
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    city: profile.city ?? "",
    countryCode: profile.country_code ?? null,
    currencyCode: profile.currency_code ?? null,
    accountType: normalizeLegacyAccountType(profile.account_type),
    canRequestServices: capabilityState.canRequestServices,
    canOfferServices: capabilityState.canOfferServices,
    capabilitySource: capabilityState.capabilitySource,
    avatarUrl: profile.avatar_url ?? null,
  };
}

async function authenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function normalizeOwnedProfiles(
  profiles: ProfileRow[],
  ownerUserId: string
): Promise<ActiveProfile[]> {
  const capabilityStates = await loadProfileCapabilityStates(
    profiles.map((profile) => ({
      id: profile.id,
      accountType: normalizeLegacyAccountType(profile.account_type),
    }))
  );

  return profiles.map((profile) =>
    normalizeProfile(
      profile,
      ownerUserId,
      capabilityStates.get(profile.id)
    )
  );
}

export async function getOwnedProfiles(): Promise<ActiveProfile[]> {
  const user = await authenticatedUser();

  if (!user) {
    return [];
  }

  /*
   * KLYX_AUTHENTICATED_PROFILE_PRIVACY_12B_12E
   *
   * La session Supabase sert uniquement à authentifier l'utilisateur.
   * Les colonnes internes nécessaires au sélecteur multi-profils
   * sont ensuite lues côté serveur avec service_role et toujours filtrées
   * par owner_user_id = user.id.
   */
  const { data: ownedData, error: ownedError } = await supabaseAdmin
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
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (ownedError) {
    throw new Error(ownedError.message);
  }

  const ownedProfiles = (ownedData ?? []) as ProfileRow[];

  if (ownedProfiles.length > 0) {
    return normalizeOwnedProfiles(ownedProfiles, user.id);
  }

  /*
   * Compatibilité uniquement pour les anciens profils KLYX.
   * La réparation legacy reste côté serveur et ne donne aucun droit
   * d'écriture direct à la session authentifiée.
   */
  const { data: legacyProfile, error: legacyError } = await supabaseAdmin
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
    throw new Error(legacyError.message);
  }

  if (!legacyProfile) {
    return [];
  }

  /* KLYX_LEGACY_PROFILE_OWNER_FAIL_CLOSED_20260905 */
  if (
    legacyProfile.owner_user_id &&
    legacyProfile.owner_user_id !== user.id
  ) {
    return [];
  }

  let profileToReturn = legacyProfile as ProfileRow;

  if (!legacyProfile.owner_user_id) {
    /* KLYX_LEGACY_PROFILE_OWNER_ATOMIC_REPAIR_20260905 */
    const { data: repairedProfile, error: repairError } = await supabaseAdmin
      .from("profiles")
      .update({
        owner_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", legacyProfile.id)
      .is("owner_user_id", null)
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
      .maybeSingle();

    if (repairError) {
      throw new Error(repairError.message);
    }

    if (!repairedProfile) {
      return [];
    }

    profileToReturn = repairedProfile as ProfileRow;
  }

  return normalizeOwnedProfiles([profileToReturn], user.id);
}

export async function getActiveProfile(): Promise<ActiveProfile | null> {
  const profiles = await getOwnedProfiles();

  if (profiles.length === 0) {
    return null;
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value?.trim();

  if (selectedId) {
    const selectedProfile = profiles.find(
      (profile) => profile.id === selectedId
    );

    if (selectedProfile) {
      return selectedProfile;
    }
  }

  return profiles[0];
}
