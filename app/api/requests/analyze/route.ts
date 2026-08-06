import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  detectBudget,
  detectChildren,
  detectCity,
  detectDurationHours,
  detectRequestedDay,
  detectRequestedTime,
  detectServiceCandidates,
  missingFieldsForRequest,
  urgencyFromText,
  wantsMemory,
  type UniversalRequestResult,
} from "@/lib/universal-service-request";

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "Baby-sitting",
  cleaning: "Ménage",
  moving: "Déménagement",
  handyman: "Bricolage",
};

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      text?: unknown;
      selectedServiceSlug?: unknown;
    };

    const text =
      typeof body.text === "string"
        ? body.text.trim().slice(0, 2000)
        : "";

    if (text.length < 3) {
      return NextResponse.json(
        {
          error:
            "Décris ton besoin avec au moins trois caractères.",
        },
        { status: 400 }
      );
    }

    const selectedServiceSlug =
      typeof body.selectedServiceSlug === "string"
        ? body.selectedServiceSlug.trim()
        : "";

    const [preferencesResult, memoryResult] =
      await Promise.all([
        supabaseAdmin
          .from("user_preferences")
          .select(
            "default_city, default_budget, preferred_service_slugs, household_notes, scheduling_notes, ai_memory_enabled"
          )
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabaseAdmin
          .from("client_memory_profiles")
          .select(
            "children_count, memory_enabled"
          )
          .eq("profile_id", profile.id)
          .maybeSingle(),
      ]);

    if (preferencesResult.error) {
      throw new Error(preferencesResult.error.message);
    }

    if (
      memoryResult.error &&
      memoryResult.error.code !== "PGRST116"
    ) {
      throw new Error(memoryResult.error.message);
    }

    const preferences = preferencesResult.data;
    const clientMemory = memoryResult.data;
    const candidates = detectServiceCandidates(text);

    let serviceSlug =
      selectedServiceSlug ||
      (candidates[0]?.confidence >= 60
        ? candidates[0].slug
        : null);
    let city = detectCity(text);
    let requestedDay = detectRequestedDay(text);
    let requestedTime = detectRequestedTime(text);
    let durationHours = detectDurationHours(text);
    let budgetMax = detectBudget(text);
    let peopleCount =
      serviceSlug === "babysitting"
        ? detectChildren(text)
        : null;
    let memoryUsed = false;

    const canUseMemory = Boolean(
      wantsMemory(text) &&
        preferences?.ai_memory_enabled &&
        (clientMemory?.memory_enabled ?? true)
    );

    if (canUseMemory) {
      memoryUsed = true;

      serviceSlug =
        serviceSlug ??
        preferences?.preferred_service_slugs?.[0] ??
        null;
      city = city ?? preferences?.default_city ?? null;
      budgetMax =
        budgetMax ??
        (preferences?.default_budget != null
          ? Number(preferences.default_budget)
          : null);
      requestedTime =
        requestedTime ??
        detectRequestedTime(
          preferences?.scheduling_notes ?? ""
        );

      if (
        serviceSlug === "babysitting" &&
        peopleCount == null
      ) {
        peopleCount =
          clientMemory?.children_count ??
          detectChildren(
            preferences?.household_notes ?? ""
          );
      }
    }

    if (
      serviceSlug &&
      !Object.prototype.hasOwnProperty.call(
        SERVICE_LABELS,
        serviceSlug
      )
    ) {
      serviceSlug = null;
    }

    const partial = {
      serviceSlug,
      city,
      requestedDay,
      requestedTime,
    };

    const missingFields =
      missingFieldsForRequest(partial);

    const parsed: UniversalRequestResult = {
      serviceSlug,
      serviceLabel: serviceSlug
        ? SERVICE_LABELS[serviceSlug] ?? serviceSlug
        : null,
      serviceCandidates: candidates,
      city,
      requestedDay,
      requestedTime,
      durationHours,
      budgetMax,
      peopleCount,
      urgency: urgencyFromText(text),
      memoryUsed,
      memoryMessage: memoryUsed
        ? "KLYX a complété uniquement les informations autorisées dans ta mémoire."
        : null,
      missingFields,
      readyForSearch: missingFields.length === 0,
    };

    const { data: serviceRequest, error } =
      await supabaseAdmin
        .from("service_requests")
        .insert({
          user_id: profile.id,
          raw_text: text,
          detected_service_slug: parsed.serviceSlug,
          city: parsed.city,
          requested_day: parsed.requestedDay,
          requested_time: parsed.requestedTime,
          budget_max: parsed.budgetMax,
          people_count: parsed.peopleCount,
          urgency: parsed.urgency,
          parsed_payload: parsed,
          status: parsed.readyForSearch
            ? "ready"
            : "analyzed",
        })
        .select("id")
        .single();

    if (error) throw new Error(error.message);

    if (memoryUsed) {
      const { error: memoryEventError } =
        await supabaseAdmin
          .from("user_memory_events")
          .insert({
            user_id: profile.id,
            event_type: "memory_used",
            event_key: "universal_service_request",
            event_value: {
              request_id: serviceRequest.id,
              used_fields: {
                service: parsed.serviceSlug,
                city: parsed.city,
                budget: parsed.budgetMax,
                time: parsed.requestedTime,
              },
            },
            confidence: 1,
            source: "system",
          });

      if (memoryEventError) {
        console.error(
          "Memory event error:",
          memoryEventError.message
        );
      }
    }

    return NextResponse.json({
      requestId: serviceRequest.id,
      parsed,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Analyse impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
