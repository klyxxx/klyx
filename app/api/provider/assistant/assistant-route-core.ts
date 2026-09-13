import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import {
  analyzeProviderAssistantMessage,
} from "@/lib/provider-assistant";
import {
  generateKlyxAiReply,
} from "@/lib/klyx-ai";
import {
  finalizeProviderUnknownAiReply,
} from "@/lib/provider-assistant-visible-ai";
import { parseProviderIncomeGoal } from "@/lib/provider-income-goal";
import { buildProviderIncomeOrchestration } from "@/lib/klyx-orchestration-server";
import {
  parseProviderAssistantPatchRequest,
  parseProviderAssistantPostRequest,
} from "./provider-assistant-http-boundary";

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
      "La demande ne correspond pas encore à une disponibilité, un devis, une réponse client ou un objectif de revenu structuré.",
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

function incomeReply(
  locale: "fr" | "en" | "nl" | "de",
  count: number,
  dayLabel: string
): { title: string; reply: string } {
  const text = {
    fr: {
      title: "Missions compatibles avec ton objectif",
      ready: `J’ai trouvé ${count} solution${count > 1 ? "s" : ""} vérifiable${count > 1 ? "s" : ""} pour ${dayLabel}. Les montants utilisent uniquement tes tarifs configurés et des durées connues. Je n’ai accepté aucune mission, envoyé aucune offre ni modifié aucun tarif. Tu peux ignorer ou refuser chaque proposition sans pénalité.`,
      empty: `Je n’ai trouvé aucune solution financière vérifiable pour ${dayLabel} avec tes compétences, zones, disponibilités, tarifs et missions déjà confirmées. Je n’ai rien accepté ni envoyé.`,
    },
    en: {
      title: "Jobs compatible with your income target",
      ready: `I found ${count} verifiable solution${count > 1 ? "s" : ""} for ${dayLabel}. Amounts use only your configured rates and known durations. I did not accept any job, send any offer, or change any rate. You can ignore or decline every option without penalty.`,
      empty: `I found no verifiable financial solution for ${dayLabel} matching your skills, areas, availability, rates and already confirmed jobs. I accepted and sent nothing.`,
    },
    nl: {
      title: "Opdrachten passend bij je inkomensdoel",
      ready: `Ik vond ${count} verifieerbare oplossing${count > 1 ? "en" : ""} voor ${dayLabel}. Bedragen gebruiken alleen je ingestelde tarieven en bekende duur. Ik heb geen opdracht geaccepteerd, geen aanbod verzonden en geen tarief gewijzigd. Je kunt elke optie zonder straf negeren of weigeren.`,
      empty: `Ik vond voor ${dayLabel} geen verifieerbare financiële oplossing die past bij je vaardigheden, zones, beschikbaarheid, tarieven en bevestigde opdrachten. Ik heb niets geaccepteerd of verzonden.`,
    },
    de: {
      title: "Aufträge passend zu deinem Einkommensziel",
      ready: `Ich habe ${count} überprüfbare Lösung${count > 1 ? "en" : ""} für ${dayLabel} gefunden. Beträge basieren nur auf deinen eingestellten Tarifen und bekannten Dauern. Ich habe keinen Auftrag angenommen, kein Angebot gesendet und keinen Tarif geändert. Jede Option kann ohne Nachteil ignoriert oder abgelehnt werden.`,
      empty: `Ich habe für ${dayLabel} keine überprüfbare finanzielle Lösung gefunden, die zu Fähigkeiten, Gebieten, Verfügbarkeit, Tarifen und bestätigten Aufträgen passt. Ich habe nichts angenommen oder gesendet.`,
    },
  }[locale];

  return {
    title: text.title,
    reply: count > 0 ? text.ready : text.empty,
  };
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
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

    return NextResponse.json({ drafts: data ?? [] });
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
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const policy = API_RATE_LIMIT_POLICIES.aiRespond;
    const rateLimit = await consumeApiRateLimit(profile.id, policy);

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    const headers = rateLimitResponseHeaders(policy, rateLimit);
    const parsedRequest = await parseProviderAssistantPostRequest(request);

    if (!parsedRequest.ok) {
      return NextResponse.json(
        {
          error: parsedRequest.error,
          code: parsedRequest.code,
        },
        {
          status: parsedRequest.status,
          headers,
        }
      );
    }

    const message = parsedRequest.value.message;
    const incomeGoal = parseProviderIncomeGoal(message);

    const result = incomeGoal
      ? await (async () => {
          const { orchestration } = await buildProviderIncomeOrchestration(
            request,
            {
              id: profile.id,
              currencyCode: profile.currencyCode,
            },
            {
              targetAmount: incomeGoal.targetAmount,
              currency: incomeGoal.currency || profile.currencyCode,
              dayOfWeek: incomeGoal.dayOfWeek,
              date: incomeGoal.date,
              startTime: incomeGoal.startTime,
              endTime: incomeGoal.endTime,
              maximumDistanceKm: incomeGoal.maximumDistanceKm,
            }
          );
          const visible = incomeReply(
            incomeGoal.locale,
            orchestration.solutions.length,
            incomeGoal.dayLabel
          );
          return {
            intent: "mission_plan" as const,
            title: visible.title,
            reply: visible.reply,
            payload: {
              goal: incomeGoal,
              orchestration,
            },
            requiresConfirmation: true as const,
          };
        })()
      : analyzeProviderAssistantMessage(
          message,
          await getHourlyRate(profile.id)
        );

    let reply = result.reply;
    let aiMode: "openai" | "fallback" = "fallback";

    /*
     * KLYX_SINGLE_AI_GATEWAY
     * Structured actions and live orchestration remain deterministic. The LLM
     * may never rewrite live jobs, configured amounts, booking facts or a
     * confirmation boundary.
     */
    if (result.intent === "unknown") {
      const improved = await improveUnknownProviderReply(
        message,
        result.reply,
        {
          intent: result.intent,
          title: result.title,
          payload: result.payload,
        }
      );

      reply = improved.reply;
      aiMode = improved.aiMode;
    }

    let draftId: string | null = null;

    if (result.intent !== "unknown" && result.intent !== "mission_plan") {
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

    return NextResponse.json(
      {
        draftId,
        ...result,
        reply,
        aiMode,
      },
      { headers }
    );
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
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const parsedRequest = await parseProviderAssistantPatchRequest(request);

    if (!parsedRequest.ok) {
      return NextResponse.json(
        {
          error: parsedRequest.error,
          code: parsedRequest.code,
        },
        { status: parsedRequest.status }
      );
    }

    const { draftId, action } = parsedRequest.value;

    const { data: draft, error: draftError } = await supabaseAdmin
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

      return NextResponse.json({ message: "Brouillon supprimé." });
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
      typeof payload.startTime === "string" ? payload.startTime : "";
    const endTime =
      typeof payload.endTime === "string" ? payload.endTime : "";

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

    const { data: userServices, error: serviceError } = await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", profile.id)
      .eq("provider_enabled", true);

    if (serviceError) throw new Error(serviceError.message);

    const serviceIds = (userServices ?? []).map((item) => item.id);

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
