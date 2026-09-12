import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  ACTIVE_PROFILE_COOKIE,
  type AccountType,
} from "@/lib/active-profile";
import { normalizeLegacyAccountType } from "@/lib/profile-actor-capabilities";
import { loadProfileCapabilityStates } from "@/lib/profile-actor-capabilities-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type AuthenticatedProfile = {
  id: string;
  ownerUserId: string;
  accountType: AccountType;
  canRequestServices: boolean;
  canOfferServices: boolean;
  firstName: string;
  lastName: string;
  countryCode: string;
  currencyCode: string;
};

type ProfileRow = {
  id: string;
  owner_user_id: string;
  account_type: string | null;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  currency_code: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variable manquante : ${name}`);
  }

  return value;
}

function supabasePublicKey(): string {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!value) {
    throw new Error("Clé publique Supabase manquante.");
  }

  return value;
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
    supabasePublicKey(),
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
    .select(
      "id, owner_user_id, account_type, first_name, last_name, country_code, currency_code"
    )
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileRows = (data ?? []) as ProfileRow[];

  if (profileRows.length === 0) {
    throw new Error("Profil KLYX introuvable.");
  }

  const capabilityStates = await loadProfileCapabilityStates(
    profileRows.map((profile) => ({
      id: profile.id,
      accountType: normalizeLegacyAccountType(profile.account_type),
    }))
  );

  const profiles: AuthenticatedProfile[] = profileRows.map((profile) => {
    const accountType = normalizeLegacyAccountType(profile.account_type);
    const capabilities = capabilityStates.get(profile.id);

    return {
      id: profile.id,
      ownerUserId: profile.owner_user_id,
      accountType,
      canRequestServices:
        capabilities?.canRequestServices ?? accountType === "client",
      canOfferServices:
        capabilities?.canOfferServices ?? accountType === "provider",
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      countryCode: profile.country_code ?? "",
      currencyCode: profile.currency_code ?? "",
    };
  });

  const selectedProfileId = (
    await cookies()
  ).get(ACTIVE_PROFILE_COOKIE)?.value;

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

// Compatibility API: call sites may keep their old role wording while the
// authorization decision itself already comes from independent capabilities.
export function requireAccountType(
  profile: AuthenticatedProfile,
  expected: AccountType
): void {
  const allowed =
    expected === "provider"
      ? profile.canOfferServices
      : profile.canRequestServices;

  if (!allowed) {
    throw new Error(
      expected === "provider"
        ? "Cette action nécessite la capacité de proposer des services."
        : "Cette action nécessite la capacité de demander des services."
    );
  }
}

export function apiErrorStatus(message: string): number {
  if (
    message === "Session manquante." ||
    message === "Session invalide."
  ) {
    return 401;
  }

  if (
    message === "Profil KLYX introuvable." ||
    message.startsWith("Cette action nécessite")
  ) {
    return 403;
  }

  if (
    message.startsWith("KLYX_PROFILE_MARKET_REQUIRED") ||
    message.startsWith("KLYX_MARKET_NOT_SUPPORTED") ||
    message.startsWith("KLYX_CURRENCY_MARKET_MISMATCH") ||
    message.startsWith("KLYX_TRANSACTION_CURRENCY_MISMATCH")
  ) {
    return 409;
  }

  return 500;
}
