import { NextResponse } from "next/server";

import { GET as getProviderKycStatus } from "@/app/api/provider/sumsub/status/route";
import { POST as legacyConversePost } from "@/app/api/brain/converse/route";
import {
  appendAssistantExchange,
  resolveAssistantConversation,
} from "@/lib/assistant-conversation";
import {
  routeKlyxAssistantCapability,
  type KlyxAssistantCapabilityRoute,
} from "@/lib/assistant-capability-router";
import {
  buildKlyxDeterministicAssistantReply,
  languageChangedReply,
} from "@/lib/assistant-deterministic-replies";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { parseBrainRespondRequest } from "@/lib/brain/respond-http-boundary";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  type KlyxSelectableLocale,
} from "@/lib/klyx-i18n";
import { getServerKlyxLocale } from "@/lib/klyx-server-i18n";

const ROUTE = "/api/assistant/unified";

function targetRequest(
  request: Request,
  pathname: string,
  options: {
    method: "GET" | "POST";
    body?: string;
  }
): Request {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";

  const headers = new Headers(request.headers);
  headers.delete("content-length");

  if (options.method === "GET") {
    headers.delete("content-type");
  }

  return new Request(url, {
    method: options.method,
    headers,
    ...(options.body === undefined ? {} : { body: options.body }),
  });
}

function legacyRequest(params: {
  request: Request;
  message?: string;
  conversationId?: string;
  rawBody?: string;
}): Request {
  const body =
    params.rawBody ??
    JSON.stringify({
      ...(params.conversationId
        ? { conversationId: params.conversationId }
        : {}),
      message: params.message ?? "",
    });

  return targetRequest(params.request, "/api/brain/converse", {
    method: "POST",
    body,
  });
}

function shouldDelegate(
  route: KlyxAssistantCapabilityRoute,
  message: string
): boolean {
  if (route.capability !== "provider_help") {
    return route.delegateToLegacy;
  }

  return /\b(?:proposer mes services|gagner|missions?|revenu|offer my services|earn|jobs?|find work|opdrachten?|verdienen|auftr[aä]ge|verdienst)\b/i.test(
    message
  );
}

function safeAction(
  action: { href: string; label: string } | null
): { href: string; label: string } | null {
  if (!action) return null;
  if (!action.href.startsWith("/") || action.href.startsWith("//")) return null;
  return action;
}

type KycStatusBody = {
  configured?: unknown;
  verification?: {
    status?: unknown;
    identity_status?: unknown;
    trust_level?: unknown;
    external_provider?: unknown;
    external_review_status?: unknown;
    external_review_answer?: unknown;
    external_updated_at?: unknown;
  } | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function kycStatusReply(
  locale: string,
  body: KycStatusBody,
  responseStatus: number
): string {
  if (responseStatus === 401 || responseStatus === 403) {
    if (locale === "en") return "KYC status is available only for an authenticated provider capability on this KLYX account.";
    if (locale === "nl") return "De KYC-status is alleen beschikbaar voor een geauthenticeerde dienstverlenerscapaciteit op dit KLYX-account.";
    if (locale === "de") return "Der KYC-Status ist nur für eine authentifizierte Anbieter-Fähigkeit dieses KLYX-Kontos verfügbar.";
    return "Le statut KYC est disponible uniquement pour une capacité prestataire authentifiée sur ce compte KLYX.";
  }

  if (body.configured !== true) {
    if (locale === "en") return "KLYX identity verification is not configured right now. I cannot invent a KYC result.";
    if (locale === "nl") return "KLYX-identiteitsverificatie is momenteel niet geconfigureerd. Ik kan geen KYC-resultaat verzinnen.";
    if (locale === "de") return "Die KLYX-Identitätsprüfung ist derzeit nicht konfiguriert. Ich kann kein KYC-Ergebnis erfinden.";
    return "La vérification d’identité KLYX n’est pas configurée actuellement. Je ne peux pas inventer un résultat KYC.";
  }

  const verification = body.verification;
  if (!verification) {
    if (locale === "en") return "No KYC verification record exists yet for your provider profile. You can start verification from the provider verification page.";
    if (locale === "nl") return "Er bestaat nog geen KYC-verificatierecord voor je dienstverlenersprofiel. Je kunt de verificatie starten op de verificatiepagina.";
    if (locale === "de") return "Für dein Anbieterprofil existiert noch kein KYC-Prüfeintrag. Du kannst die Verifizierung auf der Anbieter-Seite starten.";
    return "Aucun dossier KYC n’existe encore pour ton profil prestataire. Tu peux démarrer la vérification depuis la page de vérification prestataire.";
  }

  const status =
    text(verification.identity_status) ||
    text(verification.status) ||
    text(verification.external_review_status) ||
    "pending";
  const answer = text(verification.external_review_answer);
  const updatedAt = text(verification.external_updated_at);
  const details = [
    `status=${status}`,
    answer ? `review=${answer}` : "",
    updatedAt ? `updated=${updatedAt}` : "",
  ].filter(Boolean);

  if (locale === "en") return `Your recorded KYC state is: ${details.join(" · ")}. This is evidence from the verification engine; it does not by itself decide KLYX economic eligibility or settlement.`;
  if (locale === "nl") return `Je geregistreerde KYC-status is: ${details.join(" · ")}. Dit is bewijs uit de verificatiemotor; het bepaalt op zichzelf geen KLYX economische eligibility of settlement.`;
  if (locale === "de") return `Dein gespeicherter KYC-Status ist: ${details.join(" · ")}. Dies ist Evidenz aus der Verifizierungs-Engine; sie entscheidet allein weder KLYX Economic Eligibility noch Settlement.`;
  return `Ton état KYC enregistré est : ${details.join(" · ")}. C’est une preuve issue du moteur de vérification ; elle ne décide pas à elle seule de l’éligibilité économique KLYX ni du settlement.`;
}

async function directReply(params: {
  request: Request;
  route: KlyxAssistantCapabilityRoute;
  message: string;
  conversationId?: string;
}) {
  const startedAt = Date.now();

  try {
    const { account, profiles, canonicalProfile } =
      await getAuthenticatedProfile(params.request);
    const policy = API_RATE_LIMIT_POLICIES.brainRespond;
    const rateLimit = await consumeApiRateLimit(
      canonicalProfile.id,
      policy
    );

    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    const locale = await getServerKlyxLocale();
    const conversation = await resolveAssistantConversation({
      requestedConversationId: params.conversationId,
      profileIds: profiles.map((profile) => profile.id),
      canonicalProfileId: canonicalProfile.id,
      firstMessage: params.message,
    });

    let resolvedLocale = locale;
    let replyResult = buildKlyxDeterministicAssistantReply({
      capability: params.route.capability,
      locale,
      account: {
        firstName: canonicalProfile.firstName,
        canRequestServices: account.canRequestServices,
        canOfferServices: account.canOfferServices,
      },
    });
    let kycEvidence: Record<string, unknown> | null = null;

    if (
      params.route.capability === "kyc_explanation" &&
      params.route.wantsLiveStatus
    ) {
      const kycRequest = targetRequest(
        params.request,
        "/api/provider/sumsub/status",
        { method: "GET" }
      );
      const response = await getProviderKycStatus(kycRequest);
      let body: KycStatusBody = {};

      try {
        body = (await response.clone().json()) as KycStatusBody;
      } catch {
        body = {};
      }

      replyResult = {
        reply: kycStatusReply(locale, body, response.status),
        action: {
          href: "/provider/verification/sumsub",
          label:
            locale === "en"
              ? "Open verification"
              : locale === "nl"
                ? "Verificatie openen"
                : locale === "de"
                  ? "Verifizierung öffnen"
                  : "Ouvrir la vérification",
        },
      };
      kycEvidence = {
        source: "sumsub_status_adapter",
        responseStatus: response.status,
        configured: body.configured === true,
        verificationPresent: Boolean(body.verification),
      };
    }

    if (
      params.route.capability === "language_change" &&
      params.route.targetLocale
    ) {
      resolvedLocale = params.route.targetLocale;
      replyResult = languageChangedReply(
        params.route.targetLocale as KlyxSelectableLocale
      );
    }

    if (!replyResult) {
      return legacyConversePost(
        legacyRequest({
          request: params.request,
          message: params.message,
          conversationId: params.conversationId,
        })
      );
    }

    const action = safeAction(replyResult.action);
    const payload: Record<string, unknown> = {
      assistantIntent: "information",
      assistantCapability: params.route.capability,
      intentConfidence: "high",
      ready: false,
      missing: [],
      automaticExecutionAllowed:
        params.route.capability === "language_change",
      deterministicSafety: true,
      capabilityControl: {
        costMode: params.route.costMode,
        risk: params.route.risk,
        engines: params.route.engines,
        llmAllowed: false,
        decisionAuthority: "deterministic_engine",
      },
      ...(action ? { assistantAction: action } : {}),
      ...(kycEvidence ? { kycEvidence } : {}),
      ...(params.route.capability === "language_change"
        ? {
            localeChange: {
              locale: resolvedLocale,
              applied: true,
              engine: "tolgee",
            },
          }
        : {}),
    };

    await appendAssistantExchange({
      conversationId: conversation.conversationId,
      userMessage: params.message,
      assistantReply: replyResult.reply,
      payload,
    });

    const headers = new Headers(
      rateLimitResponseHeaders(policy, rateLimit)
    );

    if (
      params.route.capability === "language_change" &&
      params.route.targetLocale
    ) {
      headers.append(
        "Set-Cookie",
        `${KLYX_LANGUAGE_COOKIE_KEY}=${params.route.targetLocale}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
      headers.set("x-klyx-locale-change", params.route.targetLocale);
    }

    return NextResponse.json(
      {
        conversationId: conversation.conversationId,
        reply: replyResult.reply,
        payload,
        aiMode: "deterministic",
        routedCapability: params.route.capability,
        deterministicSafety: true,
      },
      { headers }
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
      event: "assistant_unified_direct_failed",
      route: ROUTE,
      method: "POST",
      status,
      code: "KLYX_ASSISTANT_UNIFIED_DIRECT_FAILED",
      publicMessage: status < 500 ? message : undefined,
      details: {
        automaticExecutionAllowed: false,
      },
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const parsed = await parseBrainRespondRequest(request.clone());

  if (!parsed.ok) {
    const rawBody = await request.clone().text();
    return legacyConversePost(
      legacyRequest({ request, rawBody })
    );
  }

  const {
    conversationId,
    message,
  } = parsed.value;
  const route = routeKlyxAssistantCapability(message);

  if (shouldDelegate(route, message)) {
    return legacyConversePost(
      legacyRequest({
        request,
        message,
        conversationId,
      })
    );
  }

  return directReply({
    request,
    route,
    message,
    conversationId,
  });
}
