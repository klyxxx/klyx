import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

export type AccountType = "client" | "provider";

export type ActiveProfile = {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  city: string;
  accountType: AccountType;
  avatarUrl: string | null;
};

type ProfileRow = {
  id: string;
  owner_user_id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  account_type: string | null;
  avatar_url: string | null;
};

function normalizeProfile(profile: ProfileRow): ActiveProfile {
  return {
    id: profile.id,
    ownerUserId: profile.owner_user_id,
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    city: profile.city ?? "",
    accountType:
      profile.account_type === "provider" ? "provider" : "client",
    avatarUrl: profile.avatar_url,
  };
}

export async function getOwnedProfiles(): Promise<ActiveProfile[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, owner_user_id, first_name, last_name, city, account_type, avatar_url"
    )
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les profils KLYX.");
  }

  return (data as ProfileRow[]).map(normalizeProfile);
}

export async function getActiveProfile(): Promise<ActiveProfile | null> {
  const profiles = await getOwnedProfiles();

  if (profiles.length === 0) {
    return null;
  }

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;

  return (
    profiles.find((profile) => profile.id === selectedId) ?? profiles[0]
  );
}
