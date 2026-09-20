import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedAccount,
  type AuthenticatedProfile,
} from "@/lib/api-auth";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  appendAssistantExchange,
  resolveAssistantConversation,
} from "@/lib/assistant-conversation";
import { routeAssistantIntent } from "@/lib/assistant-intent-router";
import { getBrainActions, type BrainActionItem } from "@/lib/brain-actions";
import {
  KLYX_CONFIRMATION_BOUNDARY,
  getKlyxGuidedQuestion,
} from "@/lib/brain/guided-question";
import { resolveAssistantWorkflow } from "@/lib/brain/orchestrator/assistant-workflow";
import { withoutKlyxLlmShadow } from "@/lib/brain/llm/shadow";
import { parseBrainRespondRequest } from "@/lib/brain/respond-http-boundary";
import { generateKlyxAiReply } from "@/lib/klyx-ai";
import { isKlyxAssistantMessageTooLong } from "@/lib/klyx-assistant-message-limits";
import { localizeKlyxGroundedAction } from "@/lib/klyx-grounded-action-i18n";
import { getServerKlyxLocale } from "@/lib/klyx-server-i18n";
import { generateKlyxVisibleAiReply } from "@/lib/klyx-visible-ai";
import { GET as getProviderJobs } from "@/app/api/provider/jobs/route";
import { POST as deterministicPost } from "../../assistant/respond/route";

const ASSISTANT_CAPABILITY_HEADER = "x-klyx-assistant-capability";

type BrainPayload = {
  intentMode?: unknown;
  serviceSlug?: unknown;
  city?: unknown;
  date?: unknown;
  time?: unknown;
  budget?: unknown;
  missing?: unknown;
  ready?: unknown;
  memoryUsed?: unknown;
};

type BrainResponseBody = {
  reply?: unknown;
  payload?: BrainPayload;
  [key: string]: unknown;
};

type ProviderJob = {
  title?: unknown;
  city?: unknown;
  requested_date?: unknown;
  budget_max?: unknown;
  budgetTotal?: unknown;
  currency?: unknown;
};

function normalizedMissing(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  );
}

function capabilityHeaders(
  request: Request,
  capability: "client" | "provider"
): Headers {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set(ASSISTANT_CAPABILITY_HEADER, capability);
  return headers;
}

function rawCapabilityRequest(
  request: Request,
  capability: "client" | "provider"
): Request {
  return new Request(request.clone(), {
    headers: capabilityHeaders(request, capability),
  });
}

function jsonCapabilityRequest(params: {
  request: Request;
  capability: "client" | "provider";
  message: string;
  conversationId?: string;
}): Request {
  const headers = capabilityHeaders(params.request, params.capability);
  headers.set("content-type", "application/json");

  return new Request(params.request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(params.conversationId
        ? { conversationId: params.conversationId }
        : {}),
      message: params.message,
    }),
  });
}

function providerCapabilityRequest(request: Request): Request {
  const headers = capabilityHeaders(request, "provider");
  headers.delete("content-type");

  return new Request(request.url, {
    method: "GET",
    headers,
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function jobsFrom(value: unknown): ProviderJob[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ProviderJob => Boolean(item) && typeof item === "object"
  );
}

function noIncomeMatch(locale: string): string {
  if (locale === "en") {
    return "I understood that you want paid work. I do not see a compatible mission yet. What kind of service can you provide?";
  }
  if (locale === "nl") {
    return "Ik begrijp dat je betaalde opdrachten zoekt. Ik zie nog geen passende opdracht. Welke dienst kun je aanbieden?";
  }
  if (locale === "de") {
    return "Ich habe verstanden, dass du bezahlte Aufträge suchst. Ich sehe noch keinen passenden Auftrag. Welche Dienstleistung kannst du anbieten?";
  }
  return "J’ai compris que tu cherches des missions rémunérées. Je ne vois pas encore de mission compatible. Quel type de service peux-tu rendre ?";
}

function incomeMatches(jobs: readonly ProviderJob[], locale: string): string {
  const selected = jobs.slice(0, 3);
  const rows = selected.map((job, index) => {
    const title = text(job.title) || "Mission";
    const budget = amount(job.budgetTotal) ?? amount(job.budget_max);
    const details = [
      text(job.city),
      text(job.requested_date),
      budget ? `${budget} ${text(job.currency) || "EUR"}` : "",
    ].filter(Boolean);

    return `${index + 1}. ${title}${
      details.length > 0 ? ` — ${details.join(" · ")}` : ""
    }`;
  });

  const tail =
    locale === "en"
      ? "Tell me which one you want to examine."
      : locale === "nl"
        ? "Zeg welke je wilt bekijken."
        : locale === "de"
          ? "Sag mir, welchen du prüfen möchtest."
          : "Dis-moi laquelle tu veux examiner.";

  return `${rows.join("\n")}\n\n${tail}`;
}

async function buildIncomeReply(
  request: Request,
  locale: string
): Promise<{ reply: string; count: number }> {
  const response = await getProviderJobs(providerCapabilityRequest(request));

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error("Provider jobs unavailable.");
    }
    return { reply: noIncomeMatch(locale), count: 0 };
  }

  const body = (await response.json()) as { requests?: unknown };
  const jobs = jobsFrom(body.requests);

  return {
    reply: jobs.length > 0 ? incomeMatches(jobs, locale) : noIncomeMatch(locale),
    count: jobs.length,
  };
}

function uniqueActions(actions: readonly BrainActionItem[]): BrainActionItem[] {
  const byId = new Map<string, BrainActionItem>();

  for (const action of actions) {
    const existing = byId.get(action.id);
    if (!existing || action.priority > existing.priority) {
      byId.set(action.id, action);
    }
  }

  return [...byId.values()];
}

function actionScore(action: BrainActionItem, rawMessage: string): number {
  const message = rawMessage.toLowerCase();
  let score = action.priority;

  if (/paiement|payer|payment|betalen|zahlung/.test(message) && /payment|finalize/.test(action.kind)) score += 1000;
  if (/suiv|statut|track|status|volg|verfolg/.test(message) && /track/.test(action.kind)) score += 1000;
  if (/termin|fini|finish|complete|klaar|fertig/.test(message) && /finish|completion|review/.test(action.kind)) score += 1000;
  if (/offre|devis|offer|quote|aanbod|angebot/.test(message) && /offer|compare/.test(action.kind)) score += 1000;

  return score;
}

async function buildManagementReply(params: {
  profiles: readonly AuthenticatedProfile[];
  message: string;
  locale: string;
}): Promise<{
  reply: string;
  action: Record<string, unknown> | null;
}> {
  const actionGroups = await Promise.all(
    params.profiles.map((profile) => getBrainActions(profile))
  );
  const selected = uniqueActions(actionGroups.flat()).sort(
    (left, right) =>
      actionScore(right, params.message) - actionScore(left, params.message)
  )[0];

  if (!selected) {
    const reply =
      params.locale === "en"
        ? "I do not see an active mission that requires an action. Which mission are you referring to?"
        : params.locale === "nl"
          ? "Ik zie geen actieve opdracht die nu een actie vereist. Over welke opdracht gaat het?"
          : params.locale === "de"
            ? "Ich sehe keinen aktiven Auftrag, der gerade eine Aktion erfordert. Welchen Auftrag meinst du?"
            : "Je ne vois pas de mission active qui demande une action maintenant. De quelle mission parles-tu ?";

    return { reply, action: null };
  }

  const localized = localizeKlyxGroundedAction(selected, params.locale);
  return {
    reply: `${localized.title}. ${localized.description}`,
    action: {
      id: selected.id,
      kind: selected.kind,
      href: localized.href,
      label: localized.label,
    },
  };
}

async function serviceResponse(params: {
  request: Request;
  message: string;
  conversationId?: string;
  accountId: string;
  profileId: string;
}): Promise<Response> {
  const capabilityRequest = jsonCapabilityRequest({
    request: params.request,
    capability: "client",
    message: params.message,
    conversationId: params.conversationId,
  });
  const suppressVisibleAiForCapacity =
    isKlyxAssistantMessageTooLong(params.message);
  const response = await withoutKlyxLlmShadow(
    () => deterministicPost(capabilityRequest)
  );

  if (!response.ok || suppressVisibleAiForCapacity) {
    return response;
  }

  let responseBody: BrainResponseBody = {};

  try {
    responseBody = (await response.clone().json()) as BrainResponseBody;
  } catch {
    return response;
  }

  const deterministicReply =
    typeof responseBody.reply === "string"
      ? responseBody.reply.trim()
      : "";

  if (!deterministicReply) return response;

  const payload = responseBody.payload ?? {};
  const resolvedConversationId =
    text(responseBody.conversationId) ||
    params.conversationId ||
    null;
  const workflow =
    resolvedConversationId && payload.intentMode !== "offer_services"
    ? await resolveAssistantWorkflow({
        accountId: params.accountId,
        profileId: params.profileId,
        conversationId: resolvedConversationId,
        intent: "service_need",
        context: {
          serviceSlug: payload.serviceSlug ?? null,
          city: payload.city ?? null,
          date: payload.date ?? null,
          time: payload.time ?? null,
          budget: payload.budget ?? null,
          ready: payload.ready === true,
        },
      })
    : null;

  // Offer activation contains payment, legal and Trust & Safety decisions.
  // Those deterministic facts must never be reworded by Visible AI in a way
  // that could weaken a blocker, invent readiness or imply automatic action.
  if (payload.intentMode === "offer_services") {
    return response;
  }

  const missing = normalizedMissing(payload.missing);
  const requiredTail =
    payload.ready === true
      ? KLYX_CONFIRMATION_BOUNDARY
      : getKlyxGuidedQuestion(missing[0]);
  const visibleReply = await generateKlyxVisibleAiReply({
    message: params.message,
    deterministicReply,
    accountType: "client",
    lockedFacts: {
      serviceSlug: payload.serviceSlug ?? null,
      city: payload.city ?? null,
      date: payload.date ?? null,
      time: payload.time ?? null,
      budget: payload.budget ?? null,
      missing,
      ready: payload.ready === true,
      memoryUsed: payload.memoryUsed === true,
    },
    requiredTail,
    suppressAiQuestions: Boolean(requiredTail),
  });

  return NextResponse.json(
    {
      ...responseBody,
      payload: {
        ...payload,
        assistantIntent: "service_need",
        workflow,
      },
      reply: visibleReply.text,
      aiMode: visibleReply.mode,
      deterministicSafety: true,
    },
    {
      status: response.status,
      headers: response.headers,
    }
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const boundedInspectionRequest = request.clone();
  const parsedRequest = await parseBrainRespondRequest(boundedInspectionRequest);

  if (!parsedRequest.ok) {
    // Keep the account-first deterministic dispatcher authoritative for auth,
    // durable quota, malformed-body status and offer-readiness boundaries.
    const capabilityRequest = rawCapabilityRequest(request, "client");
    return withoutKlyxLlmShadow(
      () => deterministicPost(capabilityRequest)
    );
  }

  try {
    const { account, profiles, canonicalProfile } =
      await getAuthenticatedAccount(request);
    const {
      conversationId: requestedConversationId,
      message,
    } = parsedRequest.value;
    const locale = await getServerKlyxLocale();

    let conversationState:
      | Awaited<ReturnType<typeof resolveAssistantConversation>>
      | null = null;

    if (requestedConversationId) {
      conversationState = await resolveAssistantConversation({
        requestedConversationId,
        profileIds: profiles.map((item) => item.id),
        canonicalProfileId: canonicalProfile.id,
        firstMessage: message,
      });
    }

    const route = routeAssistantIntent(message, {
      previousIntent: conversationState?.previousIntent ?? null,
      locale,
    });

    if (route.intent === "service_need") {
      return serviceResponse({
        request,
        message,
        conversationId: requestedConversationId,
        accountId: account.id,
        profileId: canonicalProfile.id,
      });
    }

    const policy = API_RATE_LIMIT_POLICIES.brainRespond;
    const rateLimit = await consumeApiRateLimit(
      canonicalProfile.id,
      policy
    );

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    if (!conversationState) {
      conversationState = await resolveAssistantConversation({
        profileIds: profiles.map((item) => item.id),
        canonicalProfileId: canonicalProfile.id,
        firstMessage: message,
      });
    }

    let reply = "";
    let aiMode: "openai" | "fallback" = "fallback";
    const payload: Record<string, unknown> = {
      assistantIntent: route.intent,
      intentConfidence: route.confidence,
      ready: false,
      missing: route.intent === "clarification" ? ["intent"] : [],
    };

    if (route.intent === "income_search") {
      const income = await buildIncomeReply(request, locale);
      reply = income.reply;
      payload.providerJobsCount = income.count;
    } else if (route.intent === "mission_management") {
      const management = await buildManagementReply({
        profiles,
        message,
        locale,
      });
      reply = management.reply;
      payload.assistantAction = management.action;
    } else if (route.intent === "information") {
      const information = await generateKlyxAiReply({
        message,
        firstName: canonicalProfile.firstName || undefined,
      });
      reply = information.text;
      aiMode = information.mode;
    } else {
      reply =
        route.clarificationQuestion ??
        "Tu veux que KLYX trouve un service, cherche des missions rémunérées ou gère une mission existante ?";
    }

    const workflow = await resolveAssistantWorkflow({
      accountId: account.id,
      profileId: canonicalProfile.id,
      conversationId: conversationState.conversationId,
      intent: route.intent,
      context: {
        assistantIntent: route.intent,
        intentConfidence: route.confidence,
      },
    });

    if (workflow) {
      payload.workflow = workflow;
    }

    await appendAssistantExchange({
      conversationId: conversationState.conversationId,
      userMessage: message,
      assistantReply: reply,
      payload,
    });

    return NextResponse.json(
      {
        conversationId: conversationState.conversationId,
        reply,
        payload,
        aiMode,
        routedIntent: route.intent,
        deterministicSafety: route.intent !== "information",
      },
      {
        headers: rateLimitResponseHeaders(policy, rateLimit),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Assistant KLYX indisponible.";
    const status =
      message === "Conversation introuvable."
        ? 404
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "assistant_converse_failed",
      route: "/api/brain/converse",
      method: "POST",
      status,
      code: "KLYX_ASSISTANT_CONVERSE_FAILED",
      publicMessage: status < 500 ? message : undefined,
      details: {
        automaticExecutionAllowed: false,
      },
      startedAt,
    });
  }
}
