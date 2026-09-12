import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import {
  bestBrainCommandAction,
  bestSpecificBrainCommandAction,
  hasSpecificBrainCommandIntent,
} from "@/lib/brain-command-intent";
import { getBrainActions } from "@/lib/brain-actions";
import type {
  KlyxAssistantIntentResult,
} from "@/lib/klyx-assistant-intent";
import { searchKlyxIncomeOpportunities } from "@/lib/klyx-assistant-income-search";
import { normalizeKlyxAssistantActionHref } from "@/lib/klyx-assistant-action-href";
import { generateKlyxAiReply } from "@/lib/klyx-ai";
import { localizeKlyxGroundedAction } from "@/lib/klyx-grounded-action-i18n";
import { getServerKlyxLocale } from "@/lib/klyx-server-i18n";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UnifiedRequest = {
  conversationId?: string;
  message: string;
};

type ConversationRow = {
  id: string;
};

async function resolveConversationId(
  profileId: string,
  requestedConversationId: string | undefined,
  firstMessage: string
) {
  if (requestedConversationId) {
    const { data, error } = await supabaseAdmin
      .from("brain_conversations")
      .select("id")
      .eq("id", requestedConversationId)
      .eq("user_id", profileId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Conversation introuvable.");
    return requestedConversationId;
  }

  const { data, error } = await supabaseAdmin
    .from("brain_conversations")
    .insert({
      user_id: profileId,
      title: firstMessage.slice(0, 60),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as ConversationRow).id;
}

async function recordMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin
    .from("brain_messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      payload: params.payload ?? {},
    });

  if (error) throw new Error(error.message);
}

async function touchConversation(conversationId: string) {
  const { error } = await supabaseAdmin
    .from("brain_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
}

async function missionManagementReply(
  profile: Awaited<ReturnType<typeof getAuthenticatedProfile>>["profile"],
  intent: KlyxAssistantIntentResult
) {
  const locale = await getServerKlyxLocale();
  const actions = (await getBrainActions(profile)).slice(0, 20);
  const action = hasSpecificBrainCommandIntent(intent.normalizedMessage)
    ? bestSpecificBrainCommandAction(actions, intent.normalizedMessage)
    : bestBrainCommandAction(actions, intent.normalizedMessage);

  if (!action) {
    return {
      reply:
        "Je ne vois aucune action prioritaire correspondant à cette demande pour le moment.",
      payload: {
        action: null,
        automaticExecutionAllowed: false,
      },
    };
  }

  const localized = localizeKlyxGroundedAction(action, locale);
  const href = normalizeKlyxAssistantActionHref(localized.href);

  return {
    reply: `${localized.title}. ${localized.description}${
      href ? ` Prochaine action : ${localized.label}.` : ""
    }`,
    payload: {
      action: href
        ? {
            kind: action.kind,
            title: localized.title,
            description: localized.description,
            href,
            label: localized.label,
          }
        : null,
      automaticExecutionAllowed: false,
    },
  };
}

async function informationReply(
  profile: Awaited<ReturnType<typeof getAuthenticatedProfile>>["profile"],
  message: string
) {
  const ai = await generateKlyxAiReply({
    message: [
      "Réponds à cette question dans le même assistant KLYX.",
      "Ne suppose aucun rôle client ou prestataire.",
      "N’annonce aucune action transactionnelle comme exécutée.",
      "Si une précision est nécessaire, pose une seule question courte.",
      "",
      `Question : ${message}`,
    ].join("\n"),
    firstName: profile.firstName || undefined,
  });

  return {
    reply: ai.text,
    payload: {
      aiMode: ai.mode,
      automaticExecutionAllowed: false,
    },
  };
}

export async function handleUnifiedAssistantIntent(
  request: Request,
  parsed: UnifiedRequest,
  intent: KlyxAssistantIntentResult
) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    const policy = API_RATE_LIMIT_POLICIES.brainRespond;
    const rateLimit = await consumeApiRateLimit(profile.id, policy);

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    const headers = rateLimitResponseHeaders(policy, rateLimit);
    const conversationId = await resolveConversationId(
      profile.id,
      parsed.conversationId,
      parsed.message
    );

    await recordMessage({
      conversationId,
      role: "user",
      content: parsed.message,
      payload: { assistantIntent: intent.intent },
    });

    let result: {
      reply: string;
      payload: Record<string, unknown>;
    };

    if (intent.intent === "income_search") {
      const income = await searchKlyxIncomeOpportunities(profile, parsed.message);
      result = {
        reply: income.reply,
        payload: {
          options: income.options,
          targetAmount: income.targetAmount,
          targetCurrency: income.targetCurrency,
          automaticExecutionAllowed: false,
        },
      };
    } else if (intent.intent === "mission_management") {
      result = await missionManagementReply(profile, intent);
    } else if (intent.intent === "information") {
      result = await informationReply(profile, parsed.message);
    } else {
      result = {
        reply:
          intent.clarificationQuestion ??
          "Vous voulez obtenir un service, trouver une mission, ou gérer une mission existante ?",
        payload: {
          automaticExecutionAllowed: false,
        },
      };
    }

    const payload = {
      assistantIntent: intent.intent,
      intentConfidence: intent.confidence,
      ready: false,
      missing: [],
      readiness: {
        nextMissing: null,
        requiresConfirmation: false,
        automaticExecutionAllowed: false,
      },
      ...result.payload,
    };

    await recordMessage({
      conversationId,
      role: "assistant",
      content: result.reply,
      payload,
    });
    await touchConversation(conversationId);

    return NextResponse.json(
      {
        conversationId,
        reply: result.reply,
        payload,
        aiMode:
          typeof payload.aiMode === "string" ? payload.aiMode : "fallback",
        deterministicSafety: true,
      },
      { headers }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Assistant KLYX indisponible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
