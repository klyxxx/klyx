import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { logServerError } from "@/lib/server-log";
import { supabaseAdmin } from "@/lib/supabase-admin";

function publicMessageFor(error: unknown): {
  message: string;
  status: number;
} {
  const message =
    error instanceof Error
      ? error.message
      : "Erreur inconnue.";

  return {
    message,
    status: apiErrorStatus(message),
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    const { data, error: queryError } = await supabaseAdmin
      .from("user_preferences")
      .select(
        "default_city, default_budget, preferred_service_slugs, preferred_provider_ids, household_notes, scheduling_notes, ai_memory_enabled"
      )
      .eq("user_id", profile.id)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({
      preferences: data ?? {
        default_city: "",
        default_budget: null,
        preferred_service_slugs: [],
        preferred_provider_ids: [],
        household_notes: "",
        scheduling_notes: "",
        ai_memory_enabled: true,
      },
    });
  } catch (error) {
    const { message, status } = publicMessageFor(error);

    return secureApiErrorResponse({
      error,
      event: "memory_preferences_read_failed",
      route: "/api/memory/preferences",
      method: "GET",
      status,
      code: "KLYX_MEMORY_PREFERENCES_READ_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      defaultCity?: string;
      defaultBudget?: number | null;
      preferredServiceSlugs?: string[];
      householdNotes?: string;
      schedulingNotes?: string;
      aiMemoryEnabled?: boolean;
    };

    const payload = {
      user_id: profile.id,
      default_city: body.defaultCity?.trim() || null,
      default_budget:
        body.defaultBudget == null ? null : Number(body.defaultBudget),
      preferred_service_slugs: body.preferredServiceSlugs ?? [],
      household_notes: body.householdNotes?.trim() || null,
      scheduling_notes: body.schedulingNotes?.trim() || null,
      ai_memory_enabled: body.aiMemoryEnabled ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error: upsertError } = await supabaseAdmin
      .from("user_preferences")
      .upsert(payload, {
        onConflict: "user_id",
      })
      .select(
        "default_city, default_budget, preferred_service_slugs, household_notes, scheduling_notes, ai_memory_enabled"
      )
      .single();

    if (upsertError) {
      throw upsertError;
    }

    const { error: eventError } = await supabaseAdmin
      .from("user_memory_events")
      .insert({
        user_id: profile.id,
        event_type: "preferences_updated",
        event_key: "profile_preferences",
        event_value: data,
        confidence: 1,
        source: "user",
      });

    if (eventError) {
      logServerError({
        error: eventError,
        event: "memory_preferences_event_failed",
        route: "/api/memory/preferences",
        method: "POST",
        status: 500,
        code: "KLYX_MEMORY_PREFERENCES_EVENT_FAILED",
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    }

    return NextResponse.json({ preferences: data });
  } catch (error) {
    const { message, status } = publicMessageFor(error);

    return secureApiErrorResponse({
      error,
      event: "memory_preferences_write_failed",
      route: "/api/memory/preferences",
      method: "POST",
      status,
      code: "KLYX_MEMORY_PREFERENCES_WRITE_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}
