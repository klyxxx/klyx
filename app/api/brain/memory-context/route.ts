import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "baby-sitting",
  cleaning: "ménage",
  moving: "déménagement",
  handyman: "bricolage",
};

function cleanArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : [];
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const [preferencesResult, memoryResult] =
      await Promise.all([
        supabaseAdmin
          .from("user_preferences")
          .select(
            "default_city, default_budget, preferred_service_slugs, scheduling_notes, ai_memory_enabled"
          )
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabaseAdmin
          .from("client_memory_profiles")
          .select(
            "household_type, children_count, pet_types, preferred_languages, cleaning_notes, babysitting_notes, moving_notes, handyman_notes, memory_enabled"
          )
          .eq("profile_id", profile.id)
          .maybeSingle(),
      ]);

    if (preferencesResult.error) {
      throw new Error(preferencesResult.error.message);
    }

    if (memoryResult.error) {
      throw new Error(memoryResult.error.message);
    }

    const preferences = preferencesResult.data;
    const memory = memoryResult.data;

    const enabled = Boolean(
      preferences?.ai_memory_enabled &&
        (memory?.memory_enabled ?? true)
    );

    if (!enabled) {
      return NextResponse.json({
        enabled: false,
        available: false,
        summary: [],
        quickRequests: [],
      });
    }

    const serviceSlugs = cleanArray(
      preferences?.preferred_service_slugs
    );

    const summary: {
      key: string;
      label: string;
      value: string;
    }[] = [];

    if (preferences?.default_city) {
      summary.push({
        key: "city",
        label: "Ville habituelle",
        value: preferences.default_city,
      });
    }

    if (preferences?.default_budget != null) {
      summary.push({
        key: "budget",
        label: "Budget habituel",
        value: `${Number(
          preferences.default_budget
        )} € maximum`,
      });
    }

    if (serviceSlugs.length > 0) {
      summary.push({
        key: "services",
        label: "Services préférés",
        value: serviceSlugs
          .map((slug) => SERVICE_LABELS[slug] ?? slug)
          .join(", "),
      });
    }

    if ((memory?.children_count ?? 0) > 0) {
      summary.push({
        key: "children",
        label: "Foyer",
        value: `${memory?.children_count} enfant(s)`,
      });
    }

    const pets = cleanArray(memory?.pet_types);

    if (pets.length > 0) {
      summary.push({
        key: "pets",
        label: "Animaux",
        value: pets.join(", "),
      });
    }

    const languages = cleanArray(
      memory?.preferred_languages
    );

    if (languages.length > 0) {
      summary.push({
        key: "languages",
        label: "Langues préférées",
        value: languages.join(", "),
      });
    }

    const quickRequests = serviceSlugs
      .slice(0, 4)
      .map((slug) => ({
        serviceSlug: slug,
        label: `Organiser mon ${SERVICE_LABELS[slug] ?? slug}`,
        message: `Je veux organiser un service de ${
          SERVICE_LABELS[slug] ?? slug
        } comme d’habitude.`,
      }));

    return NextResponse.json({
      enabled: true,
      available: summary.length > 0,
      summary,
      quickRequests,
      privacyNotice:
        "KLYX utilise ces habitudes uniquement pour préparer la demande. Le prestataire ne reçoit pas toute ta mémoire.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger le contexte mémoire.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
