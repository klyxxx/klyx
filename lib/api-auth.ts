import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  ACTIVE_PROFILE_COOKIE,
  type AccountType,
} from "@/lib/active-profile";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ASSISTANT_CAPABILITY_HEADER = "x-klyx-assistant-capability";

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
  countryCode: string;
  currencyCode: string;
};

export type AuthenticatedAccount = {
  id: string;
  authUserId: string;
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

type AccountRow = {
  id: string;
  auth_user_id: string;
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

function normalizeProfile(
  profile: ProfileRow
): AuthenticatedProfile {
  return {
    id: profile.id,
    ownerUserId: profile.owner_user_id,
    accountType:
      profile.account_type === "provider"
        ? "provider"
        : "client",
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    countryCode: profile.country_code ?? "",
    currencyCode: profile.currency_code ?? "",
  };
}

function assistantCapability(
  request: Request
): AccountType | null {
  let pathname = "";

  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }

  // Capability projection is deliberately restricted to the unified Brain
  // surface. It never changes the active-profile cookie or persistent data.
  if (pathname !== "/api/brain/converse") {
    return null;
  }

  const value = request.headers
    .get(ASSISTANT_CAPABILITY_HEADER)
    ?.trim()
    .toLowerCase();

  return value === "client" || value === "provider"
    ? value
    : null;
}

function projectCapability(
  profiles: readonly AuthenticatedProfile[],
  canonicalProfile: AuthenticatedProfile,
  requestedCapability: AccountType | null
): AuthenticatedProfile | null {
  if (!requestedCapability) return null;

  const matchingProfile = profiles.find(
    (item) => item.accountType === requestedCapability
  );

  if (matchingProfile) {
    return matchingProfile;
  }

  // Transitional compatibility for the roleless product model: the same
  // account profile may request or earn without mutating account_type.
  return {
    ...canonicalProfile,
    accountType: requestedCapability,
  };
}

export async function getAuthenticatedProfile(
  request: Request
): Promise<{
  user: AuthenticatedUser;
  profile: AuthenticatedProfile;
  profiles: AuthenticatedProfile[];
  canonicalProfile: AuthenticatedProfile;
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
    .order("created_at", {
      ascending: true,
    });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profiles = ((data ?? []) as ProfileRow[]).map(normalizeProfile);

  if (profiles.length === 0) {
    throw new Error("Profil KLYX introuvable.");
  }

  // Prefer the historical requester profile as the durable conversation
  // anchor when it exists. This keeps old Brain history continuous while the
  // product stops exposing permanent client/provider modes.
  const canonicalProfile =
    profiles.find((item) => item.accountType === "client") ?? profiles[0];

  const selectedProfileId = (
    await cookies()
  ).get(ACTIVE_PROFILE_COOKIE)?.value;

  const selectedProfile =
    profiles.find((item) => item.id === selectedProfileId) ?? canonicalProfile;
  const requestedCapability = assistantCapability(request);
  const projectedProfile = projectCapability(
    profiles,
    canonicalProfile,
    requestedCapability
  );
  const profile = projectedProfile ?? selectedProfile;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    profiles,
    canonicalProfile,
  };
}

export async function getAuthenticatedAccount(
  request: Request
): Promise<{
  user: AuthenticatedUser;
  account: AuthenticatedAccount;
  profile: AuthenticatedProfile;
}> {
  const authenticated = await getAuthenticatedProfile(request);

  const { data, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("id, auth_user_id")
    .eq("auth_user_id", authenticated.user.id)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }

  const account = data as AccountRow | null;

  if (!account || account.auth_user_id !== authenticated.user.id) {
    throw new Error("Compte KLYX introuvable.");
  }

  return {
    ...authenticated,
    account: {
      id: account.id,
      authUserId: account.auth_user_id,
    },
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
