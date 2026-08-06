import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

const HOUSEHOLD_TYPES = [
  "apartment",
  "house",
  "studio",
  "office",
  "other",
] as const;

function cleanText(
  value: unknown,
  maximumLength: number
): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().slice(0, maximumLength);
  return cleaned || null;
}

function cleanList(
  value: unknown,
  maximumItems: number,
  maximumLength: number
): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) =>
          item.trim().slice(0, maximumLength)
        )
        .filter(Boolean)
    ),
  ].slice(0, maximumItems);
}

async function loadMemory(profileId: string) {
  const [preferencesResult, profileResult] =
    await Promise.all([
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
          "household_type, children_count, pet_types, preferred_languages, access_notes, cleaning_notes, babysitting_notes, moving_notes, handyman_notes, memory_enabled, last_confirmed_at, updated_at"
        )
        .eq("profile_id", profileId)
        .maybeSingle(),
    ]);

  if (preferencesResult.error) {
    throw new Error(preferencesResult.error.message);
  }

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  return {
    preferences: preferencesResult.data ?? {
      default_city: null,
      default_budget: null,
      preferred_service_slugs: [],
      household_notes: null,
      scheduling_notes: null,
      ai_memory_enabled: true,
    },
    memoryProfile: profileResult.data ?? {
      household_type: null,
      children_count: 0,
      pet_types: [],
      preferred_languages: [],
      access_notes: null,
      cleaning_notes: null,
      babysitting_notes: null,
      moving_notes: null,
      handyman_notes: null,
      memory_enabled: true,
      last_confirmed_at: null,
      updated_at: null,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    return NextResponse.json(
      await loadMemory(profile.id)
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger la mémoire.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      defaultCity?: unknown;
      defaultBudget?: unknown;
      preferredServiceSlugs?: unknown;
      householdNotes?: unknown;
      schedulingNotes?: unknown;
      householdType?: unknown;
      childrenCount?: unknown;
      petTypes?: unknown;
      preferredLanguages?: unknown;
      accessNotes?: unknown;
      cleaningNotes?: unknown;
      babysittingNotes?: unknown;
      movingNotes?: unknown;
      handymanNotes?: unknown;
      memoryEnabled?: unknown;
    };

    const defaultBudget =
      body.defaultBudget === null ||
      body.defaultBudget === ""
        ? null
        : Number(body.defaultBudget);

    if (
      defaultBudget !== null &&
      (!Number.isFinite(defaultBudget) ||
        defaultBudget < 0 ||
        defaultBudget > 100000)
    ) {
      return NextResponse.json(
        { error: "Budget habituel invalide." },
        { status: 400 }
      );
    }

    const childrenCount = Number(
      body.childrenCount ?? 0
    );

    if (
      !Number.isInteger(childrenCount) ||
      childrenCount < 0 ||
      childrenCount > 20
    ) {
      return NextResponse.json(
        { error: "Nombre d’enfants invalide." },
        { status: 400 }
      );
    }

    const householdType =
      typeof body.householdType === "string" &&
      HOUSEHOLD_TYPES.includes(
        body.householdType as
          | "apartment"
          | "house"
          | "studio"
          | "office"
          | "other"
      )
        ? body.householdType
        : null;

    const memoryEnabled =
      typeof body.memoryEnabled === "boolean"
        ? body.memoryEnabled
        : true;

    const now = new Date().toISOString();

    const { error: preferencesError } =
      await supabaseAdmin
        .from("user_preferences")
        .upsert(
          {
            user_id: profile.id,
            default_city: cleanText(
              body.defaultCity,
              100
            ),
            default_budget: defaultBudget,
            preferred_service_slugs: cleanList(
              body.preferredServiceSlugs,
              20,
              50
            ),
            household_notes: cleanText(
              body.householdNotes,
              1000
            ),
            scheduling_notes: cleanText(
              body.schedulingNotes,
              1000
            ),
            ai_memory_enabled: memoryEnabled,
            updated_at: now,
          },
          {
            onConflict: "user_id",
          }
        );

    if (preferencesError) {
      throw new Error(preferencesError.message);
    }

    const { error: profileError } =
      await supabaseAdmin
        .from("client_memory_profiles")
        .upsert(
          {
            profile_id: profile.id,
            household_type: householdType,
            children_count: childrenCount,
            pet_types: cleanList(
              body.petTypes,
              10,
              40
            ),
            preferred_languages: cleanList(
              body.preferredLanguages,
              10,
              40
            ),
            access_notes: cleanText(
              body.accessNotes,
              500
            ),
            cleaning_notes: cleanText(
              body.cleaningNotes,
              1000
            ),
            babysitting_notes: cleanText(
              body.babysittingNotes,
              1000
            ),
            moving_notes: cleanText(
              body.movingNotes,
              1000
            ),
            handyman_notes: cleanText(
              body.handymanNotes,
              1000
            ),
            memory_enabled: memoryEnabled,
            last_confirmed_at: now,
            updated_at: now,
          },
          {
            onConflict: "profile_id",
          }
        );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: eventError } = await supabaseAdmin
      .from("user_memory_events")
      .insert({
        user_id: profile.id,
        event_type: "preferences_updated",
        event_key: "client_memory_profile",
        event_value: {
          memoryEnabled,
          updatedAt: now,
        },
        confidence: 1,
        source: "user",
      });

    if (eventError) {
      console.error(
        "Memory event error:",
        eventError.message
      );
    }

    return NextResponse.json({
      message: "Mémoire KLYX mise à jour.",
      ...(await loadMemory(profile.id)),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer la mémoire.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const [
      profileDelete,
      eventsDelete,
      preferencesUpdate,
    ] = await Promise.all([
      supabaseAdmin
        .from("client_memory_profiles")
        .delete()
        .eq("profile_id", profile.id),
      supabaseAdmin
        .from("user_memory_events")
        .delete()
        .eq("user_id", profile.id),
      supabaseAdmin
        .from("user_preferences")
        .upsert(
          {
            user_id: profile.id,
            default_city: null,
            default_budget: null,
            preferred_service_slugs: [],
            preferred_provider_ids: [],
            household_notes: null,
            scheduling_notes: null,
            ai_memory_enabled: false,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        ),
    ]);

    for (const result of [
      profileDelete,
      eventsDelete,
      preferencesUpdate,
    ]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    return NextResponse.json({
      message:
        "La mémoire personnelle de ce profil a été supprimée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de supprimer la mémoire.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
