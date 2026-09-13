import "server-only";

import type { AuthenticatedProfile } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AccountProfileRow = {
  id: string;
  owner_user_id: string;
  account_type: string | null;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  currency_code: string | null;
};

function normalizeAccountType(value: string | null): "client" | "provider" {
  return value === "provider" ? "provider" : "client";
}

/**
 * Compatibility scope for the unified assistant.
 *
 * KLYX still has historical profiles split by legacy client/provider roles.
 * The assistant must never switch between them based on user intent. Instead,
 * it reads every profile owned by the authenticated account and treats those
 * rows as one account-scoped data boundary until the legacy split is removed.
 */
export async function loadKlyxAccountProfiles(
  activeProfile: AuthenticatedProfile
): Promise<AuthenticatedProfile[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, owner_user_id, account_type, first_name, last_name, country_code, currency_code"
    )
    .eq("owner_user_id", activeProfile.ownerUserId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const profiles = ((data ?? []) as AccountProfileRow[]).map(
    (profile): AuthenticatedProfile => ({
      id: profile.id,
      ownerUserId: profile.owner_user_id,
      accountType: normalizeAccountType(profile.account_type),
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      countryCode: profile.country_code ?? "",
      currencyCode: profile.currency_code ?? "",
    })
  );

  if (!profiles.some((profile) => profile.id === activeProfile.id)) {
    profiles.unshift(activeProfile);
  }

  const unique = new Map<string, AuthenticatedProfile>();
  for (const profile of profiles) {
    unique.set(profile.id, profile);
  }

  return Array.from(unique.values());
}
