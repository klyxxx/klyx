import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

export async function GET(request: Request) {
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
      throw new Error(queryError.message);
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger la mémoire KLYX.",
      },
      {
        status: apiErrorStatus(
          error instanceof Error ? error.message : "Erreur inconnue."
        ),
      }
    );
  }
}

export async function POST(request: Request) {
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
      throw new Error(upsertError.message);
    }

    await supabaseAdmin.from("user_memory_events").insert({
      user_id: profile.id,
      event_type: "preferences_updated",
      event_key: "profile_preferences",
      event_value: data,
      confidence: 1,
      source: "user",
    });

    return NextResponse.json({ preferences: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer la mémoire KLYX.",
      },
      {
        status: apiErrorStatus(
          error instanceof Error ? error.message : "Erreur inconnue."
        ),
      }
    );
  }
}
