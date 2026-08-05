import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ACTIVE_PROFILE_COOKIE, type AccountType } from "@/lib/active-profile";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type AuthenticatedProfile = {
  id: string;
  ownerUserId: string;
  accountType: AccountType;
  firstName: string;
  lastName: string;
};

type ProfileRow = {
  id: string;
  owner_user_id: string;
  account_type: string | null;
  first_name: string | null;
  last_name: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

function normalizeProfile(profile: ProfileRow): AuthenticatedProfile {
  return {
    id: profile.id,
    ownerUserId: profile.owner_user_id,
    accountType: profile.account_type === "provider" ? "provider" : "client",
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
  };
}

export async function getAuthenticatedProfile(
  request: Request
): Promise<{
  user: AuthenticatedUser;
  profile: AuthenticatedProfile;
}> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Session manquante.");
  }

  const authClient = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    throw new Error("Session invalide.");
  }

  const { data, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, owner_user_id, account_type, first_name, last_name")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profiles = ((data ?? []) as ProfileRow[]).map(normalizeProfile);

  if (profiles.length === 0) {
    throw new Error("Profil KLYX introuvable.");
  }

  const selectedProfileId = (await cookies()).get(
    ACTIVE_PROFILE_COOKIE
  )?.value;

  const profile =
    profiles.find((item) => item.id === selectedProfileId) ?? profiles[0];

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
  };
}

export function requireAccountType(
  profile: AuthenticatedProfile,
  expected: AccountType
): void {
  if (profile.accountType !== expected) {
    throw new Error(
      expected === "provider"
        ? "Cette action nécessite un profil prestataire."
        : "Cette action nécessite un profil client."
    );
  }
}

export function apiErrorStatus(message: string): number {
  if (message === "Session manquante." || message === "Session invalide.") {
    return 401;
  }

  if (
    message === "Profil KLYX introuvable." ||
    message.startsWith("Cette action nécessite")
  ) {
    return 403;
  }

  return 500;
}
