import { NextResponse } from "next/server";

import { POST as brainRespondPost } from "@/app/api/brain/respond/route";
import {
  detectOfferServicesIntent,
  mergeOfferPricingDraft,
  offerRequirementQuestion,
  parseOfferAvailability,
  parseOfferDayOfWeek,
  parseOfferRadiusKm,
  type OfferAvailabilityDraft,
  type OfferPricingDraft,
} from "@/lib/account-offer-readiness";
import {
  activateAccountOfferServices,
  loadAccountOfferReadiness,
  recordAccountOfferConversationFacts,
  type AccountOfferReadiness,
} from "@/lib/account-offer-readiness-server";
import {
  apiErrorStatus,
  getAuthenticatedAccount,
} from "@/lib/api-auth";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  resolveBrainServiceSlug,
  type BrainServiceCatalogRecord,
} from "@/lib/brain-service-catalog";
import { parseBrainRespondRequest } from "@/lib/brain/respond-http-boundary";
import { buildProviderIncomeOrchestration } from "@/lib/klyx-orchestration-server";
import { detectLocation } from "@/lib/location-intent";
import {
  parseProviderIncomeGoal,
  type ParsedProviderIncomeGoal,
} from "@/lib/provider-income-goal";
import { supabaseAdmin } from "@/lib/supabase-admin";

type OfferConversationState = {
  offerFlow: true;
  serviceSlug: string | null;
  city: string | null;
  offerDayOfWeek: number | null;
  offerRadiusKm: number | null;
  offerPricing: OfferPricingDraft | null;
  offerAvailability: OfferAvailabilityDraft | null;
  incomeGoal: ParsedProviderIncomeGoal | null;
};

type AssistantPayload = Omit<OfferConversationState, "offerFlow"> & {
  offerFlow: boolean;
  intentMode: "offer_services";
  date: null;
  time: null;
  budget: null;
  memoryUsed: false;
  missing: string[];
  ready: false;
  offerReady: boolean;
  offerStatus: AccountOfferReadiness["status"];
  offerReadiness: AccountOfferReadiness;
  orchestration?: unknown;
};

type PayloadRow = {
  payload: Record<string, unknown> | null;
};

function pricingFromPayload(value: unknown): OfferPricingDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const amount = Number(row.amount);
  const pricingType =
    row.pricingType === "hourly" || row.pricingType === "fixed"
      ? row.pricingType
      : null;

  return Number.isFinite(amount) && amount > 0 && amount <= 10000
    ? { amount, pricingType }
    : null;
}

function availabilityFromPayload(value: unknown): OfferAvailabilityDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const dayOfWeek = Number(row.dayOfWeek);
  const startTime = typeof row.startTime === "string" ? row.startTime : "";
  const endTime = typeof row.endTime === "string" ? row.endTime : "";

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    !/^\d{2}:\d{2}$/.test(endTime) ||
    endTime <= startTime
  ) {
    return null;
  }

  return { dayOfWeek, startTime, endTime };
}

function incomeGoalFromPayload(value: unknown): ParsedProviderIncomeGoal | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const targetAmount = Number(row.targetAmount);
  const dayOfWeek = Number(row.dayOfWeek);

  if (
    !Number.isFinite(targetAmount) ||
    targetAmount <= 0 ||
    targetAmount > 1_000_000 ||
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    return null;
  }

  return {
    locale:
      row.locale === "en" || row.locale === "nl" || row.locale === "de"
        ? row.locale
        : "fr",
    dayLabel: typeof row.dayLabel === "string" ? row.dayLabel : "",
    targetAmount,
    currency: typeof row.currency === "string" ? row.currency : null,
    dayOfWeek,
    date: typeof row.date === "string" ? row.date : null,
    startTime: typeof row.startTime === "string" ? row.startTime : null,
    endTime: typeof row.endTime === "string" ? row.endTime : null,
    maximumDistanceKm:
      typeof row.maximumDistanceKm === "number"
        ? row.maximumDistanceKm
        : null,
  };
}

function stateFromPayload(
  payload: Record<string, unknown> | null
): OfferConversationState | null {
  if (!payload || payload.offerFlow !== true) return null;

  return {
    offerFlow: true,
    serviceSlug:
      typeof payload.serviceSlug === "string" ? payload.serviceSlug : null,
    city: typeof payload.city === "string" ? payload.city : null,
    offerDayOfWeek:
      typeof payload.offerDayOfWeek === "number" &&
      Number.isInteger(payload.offerDayOfWeek) &&
      payload.offerDayOfWeek >= 0 &&
      payload.offerDayOfWeek <= 6
        ? payload.offerDayOfWeek
        : null,
    offerRadiusKm:
      typeof payload.offerRadiusKm === "number" &&
      Number.isInteger(payload.offerRadiusKm) &&
      payload.offerRadiusKm >= 1 &&
      payload.offerRadiusKm <= 100
        ? payload.offerRadiusKm
        : null,
    offerPricing: pricingFromPayload(payload.offerPricing),
    offerAvailability: availabilityFromPayload(payload.offerAvailability),
    incomeGoal: incomeGoalFromPayload(payload.incomeGoal),
  };
}

async function accountProfileIds(accountId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((profile) => profile.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));
}

async function assertConversationOwnedByAccount(
  conversationId: string,
  accountId: string
): Promise<void> {
  const [profileIds, conversationResult] = await Promise.all([
    accountProfileIds(accountId),
    supabaseAdmin
      .from("brain_conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .maybeSingle(),
  ]);

  if (conversationResult.error) {
    throw new Error(conversationResult.error.message);
  }

  const conversation = conversationResult.data as {
    id: string;
    user_id: string;
  } | null;

  if (!conversation || !profileIds.includes(conversation.user_id)) {
    throw new Error("Conversation introuvable.");
  }
}

async function latestOfferState(
  conversationId: string,
  accountId: string
): Promise<OfferConversationState | null> {
  await assertConversationOwnedByAccount(conversationId, accountId);

  const { data, error } = await supabaseAdmin
    .from("brain_messages")
    .select("payload")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return stateFromPayload((data as PayloadRow | null)?.payload ?? null);
}

async function resolveOfferConversation(
  accountId: string,
  storageProfileId: string,
  requestedConversationId: string | undefined,
  firstMessage: string
): Promise<string> {
  if (requestedConversationId) {
    await assertConversationOwnedByAccount(requestedConversationId, accountId);
    return requestedConversationId;
  }

  const profileIds = await accountProfileIds(accountId);
  const userId = profileIds.includes(storageProfileId)
    ? storageProfileId
    : profileIds[0];

  if (!userId) throw new Error("Profil KLYX introuvable.");

  const { data, error } = await supabaseAdmin
    .from("brain_conversations")
    .insert({
      user_id: userId,
      title: firstMessage.slice(0, 60),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function loadServiceCatalog(): Promise<BrainServiceCatalogRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("slug, name")
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []).filter(
    (service): service is BrainServiceCatalogRecord =>
      typeof service.slug === "string" && service.slug.trim().length > 0
  );
}

async function profileCurrencyCode(profileId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("currency_code")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.currency_code === "string"
    ? data.currency_code.trim().toUpperCase()
    : "";
}

async function insertMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("brain_messages").insert({
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

function dayLabel(dayOfWeek: number | null): string | null {
  if (dayOfWeek === null) return null;
  return [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ][dayOfWeek] ?? null;
}

function replyForReadiness(
  readiness: AccountOfferReadiness,
  state: {
    city: string | null;
    radiusKm: number | null;
    dayOfWeek: number | null;
    pricing: OfferPricingDraft | null;
  }
): string {
  if (readiness.payoutReviewRequired) {
    return "J’ai détecté plusieurs identifiants Stripe Connect historiques sur ce même compte KLYX. Je n’en sélectionne aucun automatiquement : une revue est nécessaire avant d’activer les paiements prestataire.";
  }

  if (readiness.status === "blocked") {
    return readiness.trust.explanation
      ? `Cette activité ne peut pas être activée actuellement. ${readiness.trust.explanation}`
      : "Cette activité ne peut pas être activée actuellement pour des raisons Trust & Safety.";
  }

  const next = readiness.missing[0] ?? null;

  if (next === "zone") {
    if (state.city && state.radiusKm === null) {
      return `J’ai la commune ${state.city}. Quel rayon maximum veux-tu couvrir, en km ?`;
    }
    if (!state.city && state.radiusKm !== null) {
      return `J’ai le rayon de ${state.radiusKm} km. Dans quelle commune veux-tu travailler ?`;
    }
  }

  if (next === "availability" && state.dayOfWeek !== null) {
    const label = dayLabel(state.dayOfWeek) ?? "ce jour-là";
    return `J’ai noté ${label}. Quelles heures veux-tu ouvrir, par exemple 9h–18h ?`;
  }

  if (
    next === "pricing" &&
    state.pricing &&
    state.pricing.pricingType === null
  ) {
    return `J’ai noté ${state.pricing.amount.toFixed(2)} €. Est-ce un tarif horaire ou un prix fixe ?`;
  }

  if (next) return offerRequirementQuestion(next);

  if (readiness.status === "human_review") {
    return readiness.trust.explanation
      ? `Une revue humaine est nécessaire avant l’activation. ${readiness.trust.explanation}`
      : "Une revue humaine est nécessaire avant d’activer cette activité.";
  }

  return "Les conditions sont remplies. J’active maintenant la capacité de proposer des services.";
}

function orchestrationReply(
  goal: ParsedProviderIncomeGoal,
  orchestration: Awaited<ReturnType<typeof buildProviderIncomeOrchestration>>["orchestration"]
): string {
  const top = orchestration.solutions[0] ?? null;
  const target = goal.targetAmount.toFixed(2);

  if (!top) {
    return `Ton compte peut proposer des services. J’ai réutilisé le moteur KLYX pour ton objectif de ${target} : aucune combinaison de missions compatible n’est disponible pour l’instant. Rien n’est accepté automatiquement.`;
  }

  const missionLabels = top.missions
    .slice(0, 3)
    .map((mission) => `${mission.title} à ${mission.city}`)
    .join(" · ");

  return `Ton compte peut proposer des services. Pour ton objectif de ${target}, KLYX recommande actuellement : ${missionLabels}. Montant configuré : ${top.configuredAmount.toFixed(2)}. Rien n’est accepté automatiquement : tu gardes la confirmation finale.`;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const parsed = await parseBrainRespondRequest(request.clone());
    if (!parsed.ok) {
      return brainRespondPost(request);
    }

    const { conversationId: requestedConversationId, message } = parsed.value;
    const explicitOfferIntent = detectOfferServicesIntent(message);

    if (!explicitOfferIntent && !requestedConversationId) {
      return brainRespondPost(request);
    }

    const auth = await getAuthenticatedAccount(request);

    let previousState: OfferConversationState | null = null;
    if (requestedConversationId) {
      previousState = await latestOfferState(
        requestedConversationId,
        auth.account.id
      );
    }

    if (!detectOfferServicesIntent(message, Boolean(previousState))) {
      return brainRespondPost(request);
    }

    const policy = API_RATE_LIMIT_POLICIES.brainRespond;
    const rateLimit = await consumeApiRateLimit(auth.profile.id, policy);
    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    const [conversationId, services] = await Promise.all([
      resolveOfferConversation(
        auth.account.id,
        auth.profile.id,
        requestedConversationId,
        message
      ),
      loadServiceCatalog(),
    ]);

    const serviceSlug = resolveBrainServiceSlug({
      text: message,
      previousSlug: previousState?.serviceSlug ?? null,
      services,
    });
    const city = detectLocation(message) ?? previousState?.city ?? null;
    const currentDay = parseOfferDayOfWeek(message);
    const offerDayOfWeek = currentDay ?? previousState?.offerDayOfWeek ?? null;
    const offerRadiusKm =
      parseOfferRadiusKm(message) ?? previousState?.offerRadiusKm ?? null;
    const offerPricing = mergeOfferPricingDraft(
      message,
      previousState?.offerPricing ?? null
    );
    const parsedAvailability = parseOfferAvailability(
      message,
      offerDayOfWeek
    );
    const offerAvailability =
      parsedAvailability ??
      (currentDay === null ||
      previousState?.offerAvailability?.dayOfWeek === currentDay
        ? previousState?.offerAvailability ?? null
        : null);
    const incomeGoal =
      parseProviderIncomeGoal(message) ?? previousState?.incomeGoal ?? null;

    if (serviceSlug) {
      await recordAccountOfferConversationFacts({
        accountId: auth.account.id,
        serviceSlug,
        city,
        radiusKm: offerRadiusKm,
        pricing: offerPricing,
        availability: offerAvailability,
      });
    }

    let readiness = await loadAccountOfferReadiness({
      accountId: auth.account.id,
      serviceSlug,
    });
    let activated = auth.account.canOfferServices && readiness.status === "ready";
    let orchestration: Awaited<ReturnType<typeof buildProviderIncomeOrchestration>>["orchestration"] | null = null;
    let reply = replyForReadiness(readiness, {
      city,
      radiusKm: offerRadiusKm,
      dayOfWeek: offerDayOfWeek,
      pricing: offerPricing,
    });

    if (readiness.status === "ready") {
      const activation = await activateAccountOfferServices({
        accountId: auth.account.id,
        serviceSlug,
      });
      readiness = activation.readiness;
      activated = activation.activated;

      if (activated && incomeGoal && readiness.compatibilityProfileId) {
        const currencyCode = await profileCurrencyCode(
          readiness.compatibilityProfileId
        );
        const goalCurrency = incomeGoal.currency ?? currencyCode;

        if (/^[A-Z]{3}$/.test(currencyCode) && goalCurrency === currencyCode) {
          const result = await buildProviderIncomeOrchestration(
            request,
            {
              id: readiness.compatibilityProfileId,
              currencyCode,
            },
            {
              targetAmount: incomeGoal.targetAmount,
              currency: currencyCode,
              dayOfWeek: incomeGoal.dayOfWeek,
              date: incomeGoal.date,
              startTime:
                incomeGoal.startTime ??
                (offerAvailability?.dayOfWeek === incomeGoal.dayOfWeek
                  ? offerAvailability.startTime
                  : null),
              endTime:
                incomeGoal.endTime ??
                (offerAvailability?.dayOfWeek === incomeGoal.dayOfWeek
                  ? offerAvailability.endTime
                  : null),
              maximumDistanceKm:
                incomeGoal.maximumDistanceKm ?? offerRadiusKm,
            }
          );
          orchestration = result.orchestration;
          reply = orchestrationReply(incomeGoal, orchestration);
        } else {
          reply =
            "Ton compte peut proposer des services, mais la devise de ton objectif ne correspond pas à la devise configurée sur KLYX. Corrige la devise avant que je lance la recherche de missions.";
        }
      } else if (activated) {
        reply =
          "Ton compte KLYX peut maintenant demander des services et en proposer sans deuxième identité. Si tu veux que je cherche des missions, indique simplement combien tu veux gagner et quel jour.";
      }
    }

    const continueOfferFlow =
      readiness.status === "missing_requirements" ||
      (activated && readiness.status === "ready" && orchestration === null);
    const payload: AssistantPayload = {
      intentMode: "offer_services",
      offerFlow: continueOfferFlow,
      serviceSlug,
      city,
      date: null,
      time: null,
      budget: null,
      memoryUsed: false,
      offerDayOfWeek,
      offerRadiusKm,
      offerPricing,
      offerAvailability,
      incomeGoal,
      missing: readiness.missing,
      ready: false,
      offerReady: activated,
      offerStatus: readiness.status,
      offerReadiness: readiness,
      ...(orchestration ? { orchestration } : {}),
    };

    await insertMessage({
      conversationId,
      role: "user",
      content: message,
    });
    await insertMessage({
      conversationId,
      role: "assistant",
      content: reply,
      payload: payload as unknown as Record<string, unknown>,
    });
    await touchConversation(conversationId);

    return NextResponse.json(
      { conversationId, reply, payload },
      { headers: rateLimitResponseHeaders(policy, rateLimit) }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "Conversation introuvable."
        ? 404
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "assistant_respond_failed",
      route: "/api/assistant/respond",
      method: "POST",
      status,
      code: "KLYX_ASSISTANT_RESPOND_FAILED",
      startedAt,
    });
  }
}
