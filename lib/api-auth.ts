import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  loadAccountCapabilityState,
} from "@/lib/account-actor-capabilities-server";
import type {
  AccountCapabilitySource,
} from "@/lib/account-actor-capabilities";
import {
  ACTIVE_PROFILE_COOKIE,
  type AccountType,
} from "@/lib/active-profile";
import { getLegacyProfileCapabilityContext } from "@/lib/legacy-profile-capability-context";
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
  legacyAccountType: AccountType;
  canRequestServices: boolean;
  canOfferServices: boolean;
  capabilitySource: AccountCapabilitySource;
  firstName: string;
  lastName: string;
  countryCode: string;
  currencyCode: string;
};

export type AuthenticatedAccount = {
  id: string;
  authUserId: string;
  canRequestServices: boolean;
  canOfferServices: boolean;
  capabilitySource: AccountCapabilitySource;
  enabledCapabilities: readonly string[];
};

type ProfileRow = {
  id: string;
  owner_user_id: string;
  account_id: string | null;
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

type AuthenticatedContext = {
  user: AuthenticatedUser;
  account: AuthenticatedAccount;
  profile: AuthenticatedProfile;
  profiles: AuthenticatedProfile[];
  canonicalProfile: AuthenticatedProfile;
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

function normalizeLegacyAccountType(
  accountType: string | null
): AccountType {
  return accountType === "provider" ? "provider" : "client";
}

function requestPathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

function assistantCapability(request: Request): AccountType | null {
  const pathname = requestPathname(request);

  // Capability projection is deliberately restricted to the unified Brain
  // surface. The header selects a legacy adapter only after canonical account
  // capabilities authorize the requested operation.
  if (pathname !== "/api/brain/converse") {
    return null;
  }

  const value = request.headers
    .get(ASSISTANT_CAPABILITY_HEADER)
    ?.trim()
    .toLowerCase();

  return value === "client" || value === "provider" ? value : null;
}

function requestCompatibilityProfileFrom(
  profiles: readonly AuthenticatedProfile[]
): AuthenticatedProfile {
  const profile =
    profiles.find((item) => item.legacyAccountType === "client") ?? profiles[0];

  return {
    ...profile,
    accountType: profile.canRequestServices ? "client" : "provider",
  };
}

function offerCompatibilityProfileFrom(
  profiles: readonly AuthenticatedProfile[]
): AuthenticatedProfile {
  const profile =
    profiles.find((item) => item.legacyAccountType === "provider") ?? profiles[0];

  return {
    ...profile,
    accountType: profile.canOfferServices ? "provider" : "client",
  };
}

function projectCapability(
  profiles: readonly AuthenticatedProfile[],
  canonicalProfile: AuthenticatedProfile,
  requestedCapability: AccountType | null
): AuthenticatedProfile | null {
  if (!requestedCapability) return null;

  if (requestedCapability === "client") {
    if (!canonicalProfile.canRequestServices) return null;
    return requestCompatibilityProfileFrom(profiles);
  }

  if (!canonicalProfile.canOfferServices) return null;
  return offerCompatibilityProfileFrom(profiles);
}

function selectCompatibilityProfile(
  request: Request,
  profiles: readonly AuthenticatedProfile[],
  canonicalProfile: AuthenticatedProfile,
  selectedProfileId: string | undefined
): AuthenticatedProfile {
  const selected =
    profiles.find((item) => item.id === selectedProfileId) ?? canonicalProfile;
  const compatibilityContext = getLegacyProfileCapabilityContext();

  if (compatibilityContext === "request") {
    return requestCompatibilityProfileFrom(profiles);
  }

  if (compatibilityContext === "offer") {
    return offerCompatibilityProfileFrom(profiles);
  }

  const projectedProfile = projectCapability(
    profiles,
    canonicalProfile,
    assistantCapability(request)
  );

  if (projectedProfile) {
    return projectedProfile;
  }

  const pathname = requestPathname(request);
  const method = request.method.toUpperCase();

  // Transitional request-storage adapters for endpoints that still persist or
  // read legacy client profile foreign keys. The selected legacy cookie never
  // changes the canonical account identity or request_services authority.
  if (
    (pathname === "/api/market/requests" &&
      (method === "POST" || method === "PATCH")) ||
    pathname.startsWith("/api/brain/market-split-plan/")
  ) {
    return requestCompatibilityProfileFrom(profiles);
  }

  // Every provider API receives an offer-mode compatibility projection. The
  // projected accountType is "provider" only when the canonical account has
  // offer_services. Legacy direct role checks therefore remain fail-closed
  // during migration without making profiles.account_type authoritative.
  if (pathname.startsWith("/api/provider/")) {
    return offerCompatibilityProfileFrom(profiles);
  }

  return selected;
}

async function getAuthenticatedContext(
  request: Request
): Promise<AuthenticatedContext> {
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

  const [{ data: profileData, error: profilesError }, accountResult] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, owner_user_id, account_id, account_type, first_name, last_name, country_code, currency_code"
        )
        .eq("owner_user_id", user.id)
        .order("created_at", {
          ascending: true,
        }),
      supabaseAdmin
        .from("accounts")
        .select("id, auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
    ]);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  if (accountResult.error) {
    throw new Error(accountResult.error.message);
  }

  const profileRows = (profileData ?? []) as ProfileRow[];

  if (profileRows.length === 0) {
    throw new Error("Profil KLYX introuvable.");
  }

  const account = accountResult.data as AccountRow | null;

  if (!account || account.auth_user_id !== user.id) {
    throw new Error("Compte KLYX introuvable.");
  }

  if (
    profileRows.some(
      (profile) =>
        profile.account_id !== null && profile.account_id !== account.id
    )
  ) {
    throw new Error("KLYX_PROFILE_ACCOUNT_OWNER_MISMATCH");
  }

  const legacyProfiles = profileRows.map((profile) => ({
    accountType: normalizeLegacyAccountType(profile.account_type),
  }));
  const capabilities = await loadAccountCapabilityState(
    account.id,
    legacyProfiles
  );

  const normalizedProfiles: AuthenticatedProfile[] = profileRows.map(
    (profile) => {
      const legacyAccountType = normalizeLegacyAccountType(
        profile.account_type
      );

      return {
        id: profile.id,
        ownerUserId: profile.owner_user_id,
        accountType: legacyAccountType,
        legacyAccountType,
        canRequestServices: capabilities.canRequestServices,
        canOfferServices: capabilities.canOfferServices,
        capabilitySource: capabilities.capabilitySource,
        firstName: profile.first_name ?? "",
        lastName: profile.last_name ?? "",
        countryCode: profile.country_code ?? "",
        currencyCode: profile.currency_code ?? "",
      };
    }
  );

  const canonicalProfile =
    normalizedProfiles.find((item) => item.legacyAccountType === "client") ??
    normalizedProfiles[0];

  const selectedProfileId = (
    await cookies()
  ).get(ACTIVE_PROFILE_COOKIE)?.value;

  const profile = selectCompatibilityProfile(
    request,
    normalizedProfiles,
    canonicalProfile,
    selectedProfileId
  );

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    profiles: normalizedProfiles,
    canonicalProfile,
    account: {
      id: account.id,
      authUserId: account.auth_user_id,
      canRequestServices: capabilities.canRequestServices,
      canOfferServices: capabilities.canOfferServices,
      capabilitySource: capabilities.capabilitySource,
      enabledCapabilities: Array.from(capabilities.enabledCapabilities),
    },
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
  const { user, profile, profiles, canonicalProfile } =
    await getAuthenticatedContext(request);

  return {
    user,
    profile,
    profiles,
    canonicalProfile,
  };
}

export async function getAuthenticatedAccount(
  request: Request
): Promise<AuthenticatedContext> {
  return getAuthenticatedContext(request);
}

export function requireAccountCapability(
  account: Pick<AuthenticatedAccount, "enabledCapabilities">,
  capability: string
): void {
  if (!account.enabledCapabilities.includes(capability)) {
    throw new Error(`KLYX_ACCOUNT_CAPABILITY_REQUIRED:${capability}`);
  }
}

// Backward-compatible adapter for legacy call sites. The decision is now made
// from canonical account capabilities projected onto AuthenticatedProfile;
// account_type is retained only for storage/routing compatibility.
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
    message.startsWith("Cette action nécessite") ||
    message.startsWith("KLYX_ACCOUNT_CAPABILITY_REQUIRED:")
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
