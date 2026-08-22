import "server-only";

import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { wantsMemory } from "@/lib/universal-service-request";

export type ClientMemorySurface =
  | "request_analysis"
  | "brain"
  | "assistant"
  | "agent";

export type ClientMemoryContext = {
  enabled: boolean;
  available: boolean;
  defaultCity: string | null;
  defaultBudget: number | null;
  preferredServiceSlugs: string[];
  schedulingNotes: string | null;
  householdNotes: string | null;
  householdType: string | null;
  childrenCount: number;
  petTypes: string[];
  preferredLanguages: string[];
  cleaningNotes: string | null;
  babysittingNotes: string | null;
  movingNotes: string | null;
  handymanNotes: string | null;
};

type MemoryUsageParams = {
  profileId: string;
  surface: ClientMemorySurface;
  usedFields: string[];
  referenceId?: string | null;
};

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export async function loadClientMemoryContext(
  profileId: string
): Promise<ClientMemoryContext> {
  const [preferencesResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from("user_preferences")
      .select(
        "default_city, default_budget, preferred_service_slugs, household_notes, scheduling_notes, ai_memory_enabled"
      )
      .eq("user_id", profileId)
      .maybeSingle(),
    supabaseAdmin
      .from("client_memory_profiles")
      .select(
        "household_type, children_count, pet_types, preferred_languages, cleaning_notes, babysitting_notes, moving_notes, handyman_notes, memory_enabled"
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  if (preferencesResult.error) {
    throw preferencesResult.error;
  }

  if (
    profileResult.error &&
    profileResult.error.code !== "PGRST116"
  ) {
    throw profileResult.error;
  }

  const preferences = preferencesResult.data;
  const memoryProfile = profileResult.data;
  const enabled = Boolean(
    preferences?.ai_memory_enabled &&
      (memoryProfile?.memory_enabled ?? true)
  );
  const defaultBudget =
    preferences?.default_budget == null
      ? null
      : Number(preferences.default_budget);
  const context: ClientMemoryContext = {
    enabled,
    available: false,
    defaultCity: cleanText(preferences?.default_city),
    defaultBudget:
      defaultBudget != null && Number.isFinite(defaultBudget)
        ? defaultBudget
        : null,
    preferredServiceSlugs: cleanStringList(
      preferences?.preferred_service_slugs
    ),
    schedulingNotes: cleanText(preferences?.scheduling_notes),
    householdNotes: cleanText(preferences?.household_notes),
    householdType: cleanText(memoryProfile?.household_type),
    childrenCount: Math.max(
      0,
      Number(memoryProfile?.children_count ?? 0) || 0
    ),
    petTypes: cleanStringList(memoryProfile?.pet_types),
    preferredLanguages: cleanStringList(
      memoryProfile?.preferred_languages
    ),
    cleaningNotes: cleanText(memoryProfile?.cleaning_notes),
    babysittingNotes: cleanText(memoryProfile?.babysitting_notes),
    movingNotes: cleanText(memoryProfile?.moving_notes),
    handymanNotes: cleanText(memoryProfile?.handyman_notes),
  };

  context.available = Boolean(
    context.defaultCity ||
      context.defaultBudget != null ||
      context.preferredServiceSlugs.length > 0 ||
      context.schedulingNotes ||
      context.householdNotes ||
      context.householdType ||
      context.childrenCount > 0 ||
      context.petTypes.length > 0 ||
      context.preferredLanguages.length > 0 ||
      context.cleaningNotes ||
      context.babysittingNotes ||
      context.movingNotes ||
      context.handymanNotes
  );

  return context;
}

export function canUseClientMemory(
  text: string,
  memory: ClientMemoryContext
): boolean {
  return memory.enabled && memory.available && wantsMemory(text);
}

export function buildClientMemorySummary(
  memory: ClientMemoryContext
): string[] {
  if (!memory.enabled || !memory.available) return [];

  const summary: string[] = [];

  if (memory.defaultCity) {
    summary.push(`Ville habituelle : ${memory.defaultCity}`);
  }

  if (memory.defaultBudget != null) {
    summary.push(`Budget habituel maximum : ${memory.defaultBudget} €`);
  }

  if (memory.preferredServiceSlugs.length > 0) {
    summary.push(
      `Services préférés : ${memory.preferredServiceSlugs.join(", ")}`
    );
  }

  if (memory.schedulingNotes) {
    summary.push(`Habitudes de planning : ${memory.schedulingNotes}`);
  }

  if (memory.childrenCount > 0) {
    summary.push(`Nombre d’enfants : ${memory.childrenCount}`);
  }

  if (memory.petTypes.length > 0) {
    summary.push(`Animaux : ${memory.petTypes.join(", ")}`);
  }

  if (memory.preferredLanguages.length > 0) {
    summary.push(
      `Langues préférées : ${memory.preferredLanguages.join(", ")}`
    );
  }

  return summary.slice(0, 7);
}

export async function recordClientMemoryUsage(
  params: MemoryUsageParams
): Promise<void> {
  const usedFields = [
    ...new Set(
      params.usedFields
        .map((field) => field.trim())
        .filter(Boolean)
    ),
  ].slice(0, 20);

  if (usedFields.length === 0) return;

  const { error } = await supabaseAdmin
    .from("user_memory_events")
    .insert({
      user_id: params.profileId,
      event_type: "memory_used",
      event_key: params.surface,
      event_value: {
        surface: params.surface,
        reference_id: params.referenceId ?? null,
        used_fields: usedFields,
      },
      confidence: 1,
      source: "system",
    });

  if (error) {
    logServerError({
      error,
      event: "client_memory_usage_event_failed",
      route: "client-memory-context",
      method: "POST",
      status: 500,
      code: "KLYX_CLIENT_MEMORY_USAGE_EVENT_FAILED",
      durationMs: 0,
    });
  }
}
