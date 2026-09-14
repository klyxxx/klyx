import "server-only";

import { cookies } from "next/headers";

import { loadAccountCapabilityState } from "@/lib/account-actor-capabilities-server";
import type { AccountCapabilitySource } from "@/lib/account-actor-capabilities";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

export type AccountType = "client" | "provider";

export type ActiveProfile = {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  city: string;
  countryCode: string | null;
  currencyCode: string | null;
  accountType: AccountType;
  legacyAccountType: AccountType;
  canRequestServices: boolean;
  canOfferServices: boolean;
  capabilitySource: AccountCapabilitySource;
  avatarUrl: string | null;
};

type ProfileRow = {
  id: string;
  owner_user_id: string | null;
  account_id: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  country_code: string | null;
  currency_code: string | null;
  account_type: string | null;
  avatar_url: string | null;
};

function legacyAccountType(profile: ProfileRow): AccountType {
  return profile.account_type === "provider" ? "provider" : "client";
}

function normalizeProfile(
  profile: ProfileRow,
  fallbackOwnerUserId: string,
  capabilities: {
    canRequestServices: boolean;
    canOfferServices: boolean;
    capabilitySource: AccountCapabilitySource;
  }
): ActiveProfile {
  const accountType = legacyAccountType(profile);

  return {
    id: profile.id,
    ownerUserId: profile.owner_user_id ?? fallbackOwnerUserId,
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    city: profile.city ?? "",
    countryCode: profile.country_code ?? null,
    currencyCode: profile.currency_code ?? null,
    // Kept only for backward-compatible consumers. Permissions below come
    // from the canonical account and are identical across sibling profiles.
    accountType,
    legacyAccountType: accountType,
    canRequestServices: capabilities.canRequestServices,
    canOfferServices: capabilities.canOfferServices,
    capabilitySource: capabilities.capabilitySource,
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
  ownerUserId: string,
  profiles: readonly ProfileRow[]
): Promise<ActiveProfile[]> {
  const { data: accountData, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("id, auth_user_id")
    .eq("auth_user_id", ownerUserId)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }

  const account = accountData as {
    id: string;
    auth_user_id: string;
  } | null;

  if (!account || account.auth_user_id !== ownerUserId) {
    throw new Error("Compte KLYX introuvable.");
  }

  if (
    profiles.some(
      (profile) =>
        profile.account_id !== null && profile.account_id !== account.id
    )
  ) {
    throw new Error("KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH");
  }

  const capabilityState = await loadAccountCapabilityState(
    account.id,
    profiles.map((profile) => ({
      accountType: legacyAccountType(profile),
    }))
  );

  return profiles.map((profile) =>
    normalizeProfile(profile, ownerUserId, capabilityState)
  );
}

const PROFILE_SELECT = `
  id,
  owner_user_id,
  account_id,
  first_name,
  last_name,
  city,
  country_code,
  currency_code,
  account_type,
  avatar_url
`;

export async function getOwnedProfiles(): Promise<ActiveProfile[]> {
  const user = await authenticatedUser();

  if (!user) {
    return [];
  }

  const { data: ownedData, error: ownedError } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (ownedError) {
    throw new Error(ownedError.message);
  }

  const ownedProfiles = (ownedData ?? []) as ProfileRow[];

  if (ownedProfiles.length > 0) {
    return normalizeOwnedProfiles(user.id, ownedProfiles);
  }

  // Legacy repair remains storage compatibility only. The repaired profile is
  // bound to public.accounts by the canonical-account trigger from Phase 1.
  const { data: legacyProfile, error: legacyError } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  if (!legacyProfile) {
    return [];
  }

  if (
    legacyProfile.owner_user_id &&
    legacyProfile.owner_user_id !== user.id
  ) {
    return [];
  }

  let profileToReturn = legacyProfile as ProfileRow;

  if (!legacyProfile.owner_user_id) {
    const { data: repairedProfile, error: repairError } = await supabaseAdmin
      .from("profiles")
      .update({
        owner_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", legacyProfile.id)
      .is("owner_user_id", null)
      .select(PROFILE_SELECT)
      .maybeSingle();

    if (repairError) {
      throw new Error(repairError.message);
    }

    if (!repairedProfile) {
      return [];
    }

    profileToReturn = repairedProfile as ProfileRow;
  }

  return normalizeOwnedProfiles(user.id, [profileToReturn]);
}

export async function getActiveProfile(): Promise<ActiveProfile | null> {
  const profiles = await getOwnedProfiles();

  if (profiles.length === 0) {
    return null;
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore
    .get(ACTIVE_PROFILE_COOKIE)
    ?.value
    ?.trim();

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
