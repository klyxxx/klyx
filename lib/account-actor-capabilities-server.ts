import "server-only";

import {
  legacyFallbackAccountCapabilityState,
  resolveAccountCapabilityState,
  type AccountCapabilityRow,
  type AccountCapabilityState,
  type LegacyCapabilityProfile,
} from "@/lib/account-actor-capabilities";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CapabilityError = {
  code?: string | null;
  message?: string | null;
};

const CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9_.:-]{2,127}$/;

function isCapabilityTableUnavailable(error: CapabilityError): boolean {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("account_actor_capabilities") &&
      (message.includes("does not exist") ||
        message.includes("schema cache")))
  );
}

function assertCapabilityKey(capability: string): void {
  if (!CAPABILITY_KEY_PATTERN.test(capability)) {
    throw new Error("KLYX_INVALID_ACCOUNT_CAPABILITY");
  }
}

export async function loadAccountCapabilityState(
  accountId: string,
  legacyProfiles: readonly LegacyCapabilityProfile[] = []
): Promise<AccountCapabilityState> {
  const { data, error } = await supabaseAdmin
    .from("account_actor_capabilities")
    .select("account_id, capability, enabled")
    .eq("account_id", accountId);

  if (error) {
    // Mixed-version deploy/rollback compatibility only. Once the table exists,
    // missing rows never fall back to a profile role: they fail closed.
    if (isCapabilityTableUnavailable(error)) {
      return legacyFallbackAccountCapabilityState(legacyProfiles);
    }

    throw new Error(error.message);
  }

  return resolveAccountCapabilityState(
    (data ?? []) as AccountCapabilityRow[]
  );
}

export async function writeAccountCapabilities(
  accountId: string,
  capabilities: Readonly<Record<string, boolean>>,
  options: {
    source?: "user" | "system" | "admin" | "migration";
  } = {}
): Promise<void> {
  const entries = Object.entries(capabilities);

  if (entries.length === 0) {
    return;
  }

  for (const [capability] of entries) {
    assertCapabilityKey(capability);
  }

  const now = new Date().toISOString();
  const source = options.source ?? "user";
  const { error } = await supabaseAdmin
    .from("account_actor_capabilities")
    .upsert(
      entries.map(([capability, enabled]) => ({
        account_id: accountId,
        capability,
        enabled,
        source,
        updated_at: now,
      })),
      {
        onConflict: "account_id,capability",
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureLegacyOfferCompatibilityProfile(
  accountId: string
): Promise<string> {
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profiles = (profileData ?? []) as Array<{
    id: string;
    account_type: string | null;
    created_at: string | null;
  }>;

  if (profiles.length === 0) {
    throw new Error("Profil KLYX introuvable.");
  }

  const profileIds = profiles.map((profile) => profile.id);
  const { data: providerData, error: providerError } = await supabaseAdmin
    .from("provider_profiles")
    .select("profile_id")
    .in("profile_id", profileIds);

  if (providerError) {
    throw new Error(providerError.message);
  }

  const existingProviderProfileIds = new Set(
    ((providerData ?? []) as Array<{ profile_id: string }>).map(
      (row) => row.profile_id
    )
  );

  const compatibilityProfile =
    profiles.find((profile) => existingProviderProfileIds.has(profile.id)) ??
    profiles.find((profile) => profile.account_type === "provider") ??
    profiles[0];

  if (!existingProviderProfileIds.has(compatibilityProfile.id)) {
    const { error: upsertError } = await supabaseAdmin
      .from("provider_profiles")
      .upsert(
        {
          profile_id: compatibilityProfile.id,
          is_published: false,
        },
        {
          onConflict: "profile_id",
          ignoreDuplicates: true,
        }
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  return compatibilityProfile.id;
}
