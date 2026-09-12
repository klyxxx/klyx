import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  legacyCapabilityState,
  resolveProfileCapabilityState,
  type LegacyAccountType,
  type ProfileActorCapabilityRow,
  type ProfileCapabilityState,
} from "@/lib/profile-actor-capabilities";

type CapabilityProfileRef = {
  id: string;
  accountType: LegacyAccountType;
};

type CapabilityError = {
  code?: string | null;
  message?: string | null;
};

function isCapabilityTableUnavailable(error: CapabilityError): boolean {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("profile_actor_capabilities") &&
      (message.includes("does not exist") ||
        message.includes("schema cache")))
  );
}

export async function loadProfileCapabilityStates(
  profiles: readonly CapabilityProfileRef[]
): Promise<Map<string, ProfileCapabilityState>> {
  const states = new Map<string, ProfileCapabilityState>();

  for (const profile of profiles) {
    states.set(profile.id, legacyCapabilityState(profile.accountType));
  }

  if (profiles.length === 0) {
    return states;
  }

  const { data, error } = await supabaseAdmin
    .from("profile_actor_capabilities")
    .select("profile_id, capability, enabled")
    .in(
      "profile_id",
      profiles.map((profile) => profile.id)
    );

  if (error) {
    if (isCapabilityTableUnavailable(error)) {
      return states;
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as ProfileActorCapabilityRow[];
  const rowsByProfile = new Map<string, ProfileActorCapabilityRow[]>();

  for (const row of rows) {
    const current = rowsByProfile.get(row.profile_id) ?? [];
    current.push(row);
    rowsByProfile.set(row.profile_id, current);
  }

  for (const profile of profiles) {
    states.set(
      profile.id,
      resolveProfileCapabilityState(
        profile.accountType,
        rowsByProfile.get(profile.id) ?? []
      )
    );
  }

  return states;
}

export async function writeProfileCapabilityState(
  profileId: string,
  state: Pick<
    ProfileCapabilityState,
    "canRequestServices" | "canOfferServices"
  >,
  options: {
    source?: "user" | "system" | "legacy_backfill";
    allowMissingTable?: boolean;
  } = {}
): Promise<void> {
  if (!state.canRequestServices && !state.canOfferServices) {
    throw new Error("KLYX_PROFILE_CAPABILITY_REQUIRED");
  }

  const now = new Date().toISOString();
  const source = options.source ?? "user";
  const { error } = await supabaseAdmin
    .from("profile_actor_capabilities")
    .upsert(
      [
        {
          profile_id: profileId,
          capability: "request_services",
          enabled: state.canRequestServices,
          source,
          updated_at: now,
        },
        {
          profile_id: profileId,
          capability: "offer_services",
          enabled: state.canOfferServices,
          source,
          updated_at: now,
        },
      ],
      {
        onConflict: "profile_id,capability",
      }
    );

  if (error) {
    if (options.allowMissingTable && isCapabilityTableUnavailable(error)) {
      return;
    }

    throw new Error(error.message);
  }

  if (state.canOfferServices) {
    const { error: providerProfileError } = await supabaseAdmin
      .from("provider_profiles")
      .upsert(
        {
          profile_id: profileId,
        },
        {
          onConflict: "profile_id",
          ignoreDuplicates: true,
        }
      );

    if (providerProfileError) {
      throw new Error(providerProfileError.message);
    }
  }
}
