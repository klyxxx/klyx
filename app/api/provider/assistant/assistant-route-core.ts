import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  analyzeProviderAssistantMessage,
  type ProviderAssistantIntent,
} from "@/lib/provider-assistant";
import {
  generateKlyxAiReply,
} from "@/lib/klyx-ai";
import {
  finalizeProviderUnknownAiReply,
} from "@/lib/provider-assistant-visible-ai";

async function getHourlyRate(
  profileId: string
): Promise<number | null> {
  const { data: userServices, error: userServicesError } =
    await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", profileId)
      .eq("provider_enabled", true);

  if (userServicesError) {
    throw new Error(userServicesError.message);
  }

  const ids = (userServices ?? []).map((item) => item.id);

  if (ids.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("service_profiles")
    .select("price, pricing_type")
    .in("user_service_id", ids)
    .eq("available", true)
    .eq("pricing_type", "hourly")
    .not("price", "is", null)
    .order("price", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data?.price == null ? null : Number(data.price);
}

async function improveUnknownProviderReply(
  message: string,
  fallback: string,
  lockedFacts: Record<string, unknown>
): Promise<{
  reply: string;
  aiMode: "openai" | "fallback";
}> {
  const ai = await generateKlyxAiReply({
    message: [
      "Tu réponds à un prestataire KLYX dans son assistant professionnel.",
      "La demande ne correspond pas encore à une disponibilité, un devis ou une réponse client structurée.",
      "Réponds utilement et brièvement sans prétendre avoir exécuté une action.",
      "Si une précision est nécessaire, pose une seule question.",
      "",
      `Message du prestataire : ${message}`,
    ].join("\n"),
    accountType: "provider",
  });

  return finalizeProviderUnknownAiReply({
    aiMode: ai.mode,
    candidate: ai.text,
    deterministicReply: fallback,
    lockedFacts,
  });
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const { data, error } = await supabaseAdmin
      .from("provider_assistant_drafts")
      .select(
        "id, draft_type, title, payload, status, created_at, updated_at, applied_at"
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      drafts: data ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger l’assistant.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      message?: unknown;
    };

    const message =
      typeof body.message === "string"
        ? body.message.trim().slice(0, 1000)
        : "";

    if (message.length < 3) {
      return NextResponse.json(
        { error: "Décris ce que tu veux préparer." },
        { status: 400 }
      );
    }

    const hourlyRate = await getHourlyRate(profile.id);
    const result = analyzeProviderAssistantMessage(
      message,
      hourlyRate
    );

    let reply = result.reply;
    let aiMode: "openai" | "fallback" = "fallback";

    /*
     * KLYX_SINGLE_AI_GATEWAY
     * Structured provider actions stay deterministic. The shared LLM is
     * used only for non-transactional conversation, so it can never change
     * a draft payload, a quote amount or an availability before confirmation.
     */
    if (result.intent === "unknown") {
      const improved =
        await improveUnknownProviderReply(
          message,
          result.reply,
          {
            intent: result.intent,
            title: result.title,
            draftId: null,
            payload: result.payload,
          }
        );

      reply = improved.reply;
      aiMode = improved.aiMode;
    }

    let draftId: string | null = null;

    if (result.intent !== "unknown") {
      const { data, error } = await supabaseAdmin
        .from("provider_assistant_drafts")
        .insert({
          profile_id: profile.id,
          draft_type: result.intent,
          title: result.title,
          payload: result.payload,
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      draftId = data.id;
    }

    return NextResponse.json({
      draftId,
      ...result,
      reply,
      aiMode,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de préparer cette action.";

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

    requireAccountType(profile, "provider");

    const body = (await request.json()) as {
      draftId?: unknown;
      action?: unknown;
    };

    const draftId =
      typeof body.draftId === "string"
        ? body.draftId.trim()
        : "";
    const action =
      body.action === "apply" ||
      body.action === "discard"
        ? body.action
        : null;

    if (!draftId || !action) {
      return NextResponse.json(
        { error: "Action invalide." },
        { status: 400 }
      );
    }

    const { data: draft, error: draftError } =
      await supabaseAdmin
        .from("provider_assistant_drafts")
        .select("id, draft_type, payload, status")
        .eq("id", draftId)
        .eq("profile_id", profile.id)
        .maybeSingle();

    if (draftError) throw new Error(draftError.message);

    if (!draft) {
      return NextResponse.json(
        { error: "Brouillon introuvable." },
        { status: 404 }
      );
    }

    if (draft.status !== "draft") {
      return NextResponse.json(
        { error: "Ce brouillon a déjà été traité." },
        { status: 409 }
      );
    }

    if (action === "discard") {
      const { error } = await supabaseAdmin
        .from("provider_assistant_drafts")
        .update({
          status: "discarded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id)
        .eq("profile_id", profile.id);

      if (error) throw new Error(error.message);

      return NextResponse.json({
        message: "Brouillon supprimé.",
      });
    }

    if (draft.draft_type !== "availability") {
      return NextResponse.json(
        {
          error:
            "Les réponses et devis restent des brouillons à copier manuellement.",
        },
        { status: 409 }
      );
    }

    const payload = draft.payload as {
      dayOfWeek?: unknown;
      startTime?: unknown;
      endTime?: unknown;
    };

    const dayOfWeek = Number(payload.dayOfWeek);
    const startTime =
      typeof payload.startTime === "string"
        ? payload.startTime
        : "";
    const endTime =
      typeof payload.endTime === "string"
        ? payload.endTime
        : "";

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
      endTime <= startTime
    ) {
      return NextResponse.json(
        { error: "Créneau invalide." },
        { status: 400 }
      );
    }

    const { data: userServices, error: serviceError } =
      await supabaseAdmin
        .from("user_services")
        .select("id")
        .eq("user_id", profile.id)
        .eq("provider_enabled", true);

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    const serviceIds = (userServices ?? []).map(
      (item) => item.id
    );

    if (serviceIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Active au moins un métier dans le Studio prestataire.",
        },
        { status: 409 }
      );
    }

    for (const userServiceId of serviceIds) {
      const { error: deleteError } = await supabaseAdmin
        .from("availability_slots")
        .delete()
        .eq("user_service_id", userServiceId)
        .eq("day_of_week", dayOfWeek);

      if (deleteError) throw new Error(deleteError.message);

      const { error: insertError } = await supabaseAdmin
        .from("availability_slots")
        .insert({
          user_service_id: userServiceId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          is_active: true,
        });

      if (insertError) throw new Error(insertError.message);
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("provider_assistant_drafts")
      .update({
        status: "applied",
        applied_at: now,
        updated_at: now,
      })
      .eq("id", draft.id)
      .eq("profile_id", profile.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      message:
        "Disponibilité appliquée à tous tes métiers actifs.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de traiter le brouillon.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
