import { NextResponse } from "next/server";

import { POST as legacyConversePost } from "@/app/api/brain/converse/route";
import { POST as offerServicesPost } from "@/app/api/assistant/respond/route";
import { detectOfferServicesIntent } from "@/lib/account-offer-readiness";
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
import { secureApiErrorResponse } from "@/lib/api-error";
import {
  appendAssistantExchange,
  resolveAssistantConversation,
} from "@/lib/assistant-conversation";
import { assistantEnginePlan } from "@/lib/assistant-engine-policy";
import {
  loadAssistantKyc,
  loadLatestAssistantBooking,
  type AssistantBookingSnapshot,
  type AssistantKycSnapshot,
} from "@/lib/assistant-grounded-state";
import { routeAssistantIntent } from "@/lib/assistant-intent-router";
import {
  accountHelp,
  detectRequestedAssistantLocale,
  deterministicInformation,
  languageChangeReply,
  normalizeAssistantLocale,
  providerHelp,
  type AssistantGroundedAction,
  type AssistantLocale,
} from "@/lib/assistant-product-help";
import { parseBrainRespondRequest } from "@/lib/brain/respond-http-boundary";
import { KLYX_LANGUAGE_COOKIE_KEY } from "@/lib/klyx-i18n";
import { getServerKlyxLocale } from "@/lib/klyx-server-i18n";

function localize(
  locale: AssistantLocale,
  values: Record<AssistantLocale, string>
): string {
  return values[locale];
}

function bookingAction(
  booking: AssistantBookingSnapshot | null,
  locale: AssistantLocale
): AssistantGroundedAction {
  return {
    id: booking ? `booking-${booking.id}` : "open-bookings",
    kind: "booking_tracking",
    href: booking?.href ?? "/bookings",
    label: localize(locale, {
      fr: booking ? "Voir la réservation" : "Voir mes réservations",
      en: booking ? "View booking" : "View my bookings",
      nl: booking ? "Boeking bekijken" : "Mijn boekingen bekijken",
      de: booking ? "Buchung ansehen" : "Meine Buchungen ansehen",
    }),
  };
}

function bookingTrackingReply(
  booking: AssistantBookingSnapshot | null,
  locale: AssistantLocale
): string {
  if (!booking) {
    return localize(locale, {
      fr: "Je ne vois aucune réservation liée à ton compte KLYX pour l’instant.",
      en: "I do not see any booking linked to your KLYX account yet.",
      nl: "Ik zie nog geen boeking die aan je KLYX-account is gekoppeld.",
      de: "Ich sehe derzeit keine Buchung, die mit deinem KLYX-Konto verknüpft ist.",
    });
  }

  return localize(locale, {
    fr: `Dernière réservation : statut ${booking.status}, paiement ${booking.paymentStatus}, remboursement ${booking.refundStatus}.`,
    en: `Latest booking: status ${booking.status}, payment ${booking.paymentStatus}, refund ${booking.refundStatus}.`,
    nl: `Laatste boeking: status ${booking.status}, betaling ${booking.paymentStatus}, terugbetaling ${booking.refundStatus}.`,
    de: `Letzte Buchung: Status ${booking.status}, Zahlung ${booking.paymentStatus}, Rückerstattung ${booking.refundStatus}.`,
  });
}

function paymentReply(
  booking: AssistantBookingSnapshot | null,
  locale: AssistantLocale
): string {
  if (!booking) {
    return localize(locale, {
      fr: "Le paiement KLYX est exécuté par le moteur de paiement côté serveur après les confirmations applicables. Je ne déclenche ni ne valide un paiement moi-même. Je ne vois actuellement aucune réservation à laquelle rattacher un statut de paiement.",
      en: "KLYX payments are executed by the server-side payment engine after the applicable confirmations. I do not trigger or approve a payment myself. I currently see no booking to attach a payment status to.",
      nl: "KLYX-betalingen worden na de toepasselijke bevestigingen uitgevoerd door de betaalmotor aan de serverkant. Ik start of keur zelf geen betaling goed. Ik zie momenteel geen boeking met een betaalstatus.",
      de: "KLYX-Zahlungen werden nach den erforderlichen Bestätigungen von der serverseitigen Zahlungs-Engine ausgeführt. Ich löse selbst keine Zahlung aus und genehmige sie nicht. Derzeit sehe ich keine Buchung mit Zahlungsstatus.",
    });
  }

  return localize(locale, {
    fr: `Pour ta dernière réservation, le statut de paiement enregistré par KLYX est « ${booking.paymentStatus} ». Stripe reste un fournisseur externe : la vérité et les autorisations KLYX sont vérifiées côté serveur. Je ne peux pas autoriser ou capturer le paiement directement.`,
    en: `For your latest booking, the payment status recorded by KLYX is “${booking.paymentStatus}”. Stripe remains an external provider: KLYX truth and authorization are checked server-side. I cannot directly authorize or capture the payment.`,
    nl: `Voor je laatste boeking is de door KLYX geregistreerde betaalstatus “${booking.paymentStatus}”. Stripe blijft een externe provider: de KLYX-waarheid en autorisatie worden server-side gecontroleerd. Ik kan de betaling niet rechtstreeks autoriseren of innen.`,
    de: `Für deine letzte Buchung lautet der von KLYX gespeicherte Zahlungsstatus „${booking.paymentStatus}“. Stripe bleibt ein externer Anbieter: KLYX-Wahrheit und Autorisierung werden serverseitig geprüft. Ich kann die Zahlung nicht direkt autorisieren oder erfassen.`,
  });
}

function refundReply(
  booking: AssistantBookingSnapshot | null,
  locale: AssistantLocale
): string {
  if (!booking) {
    return localize(locale, {
      fr: "Un remboursement est décidé et exécuté par les moteurs KLYX côté serveur, avec contrôle du ledger et de Stripe. Je ne décide jamais d’un remboursement directement. Je ne vois actuellement aucune réservation concernée.",
      en: "A refund is decided and executed by KLYX server-side engines, with ledger and Stripe checks. I never decide a refund directly. I currently see no related booking.",
      nl: "Een terugbetaling wordt beslist en uitgevoerd door de KLYX-motoren aan de serverkant, met controle van ledger en Stripe. Ik beslis nooit zelf over een terugbetaling. Ik zie momenteel geen betrokken boeking.",
      de: "Eine Rückerstattung wird von den serverseitigen KLYX-Engines entschieden und ausgeführt, mit Prüfung von Ledger und Stripe. Ich entscheide niemals selbst über eine Rückerstattung. Derzeit sehe ich keine betroffene Buchung.",
    });
  }

  return localize(locale, {
    fr: `Pour ta dernière réservation, le statut de remboursement enregistré est « ${booking.refundStatus} ». Je peux l’expliquer et le suivre, mais la décision et l’exécution restent dans le moteur de remboursement KLYX.`,
    en: `For your latest booking, the recorded refund status is “${booking.refundStatus}”. I can explain and track it, but the decision and execution remain in the KLYX refund engine.`,
    nl: `Voor je laatste boeking is de geregistreerde terugbetalingsstatus “${booking.refundStatus}”. Ik kan die uitleggen en volgen, maar beslissing en uitvoering blijven bij de KLYX-terugbetalingsmotor.`,
    de: `Für deine letzte Buchung lautet der gespeicherte Rückerstattungsstatus „${booking.refundStatus}“. Ich kann ihn erklären und verfolgen, aber Entscheidung und Ausführung bleiben bei der KLYX-Rückerstattungs-Engine.`,
  });
}

function kycReply(
  verification: AssistantKycSnapshot | null,
  locale: AssistantLocale
): string {
  if (!verification) {
    return localize(locale, {
      fr: "Le KYC sert à vérifier l’identité d’un prestataire. Sumsub fournit la vérification externe, mais KLYX garde séparément ses règles d’éligibilité. Je n’accorde ni ne refuse le KYC moi-même.",
      en: "KYC verifies a provider’s identity. Sumsub provides the external verification, while KLYX keeps its eligibility rules separate. I do not approve or reject KYC myself.",
      nl: "KYC controleert de identiteit van een dienstverlener. Sumsub levert de externe verificatie, terwijl KLYX zijn geschiktheidsregels apart houdt. Ik keur KYC zelf niet goed of af.",
      de: "KYC prüft die Identität eines Anbieters. Sumsub liefert die externe Verifizierung, während KLYX seine Eignungsregeln getrennt hält. Ich genehmige oder verweigere KYC nicht selbst.",
    });
  }

  return localize(locale, {
    fr: `État KYC enregistré : statut ${verification.status}, identité ${verification.identityStatus}, revue externe ${verification.reviewStatus}. Sumsub est une projection externe ; l’éligibilité KLYX reste une autorité distincte côté serveur.`,
    en: `Recorded KYC state: status ${verification.status}, identity ${verification.identityStatus}, external review ${verification.reviewStatus}. Sumsub is an external projection; KLYX eligibility remains a separate server-side authority.`,
    nl: `Geregistreerde KYC-status: status ${verification.status}, identiteit ${verification.identityStatus}, externe review ${verification.reviewStatus}. Sumsub is een externe projectie; KLYX-geschiktheid blijft een afzonderlijke server-side autoriteit.`,
    de: `Gespeicherter KYC-Stand: Status ${verification.status}, Identität ${verification.identityStatus}, externe Prüfung ${verification.reviewStatus}. Sumsub ist eine externe Projektion; die KLYX-Eignung bleibt eine getrennte serverseitige Autorität.`,
  });
}

function kycAction(locale: AssistantLocale): AssistantGroundedAction {
  return {
    id: "open-kyc",
    kind: "kyc_verification",
    href: "/provider/verification/sumsub",
    label: localize(locale, {
      fr: "Ouvrir la vérification d’identité",
      en: "Open identity verification",
      nl: "Identiteitsverificatie openen",
      de: "Identitätsprüfung öffnen",
    }),
  };
}

function safePayload(params: {
  intent: string;
  confidence: string;
  action?: AssistantGroundedAction;
  localeChange?: AssistantLocale;
  extra?: Record<string, unknown>;
}) {
  return {
    assistantIntent: params.intent,
    intentConfidence: params.confidence,
    ready: false,
    missing: [],
    ...(params.action ? { assistantAction: params.action } : {}),
    ...(params.localeChange ? { localeChange: params.localeChange } : {}),
    ...(params.extra ?? {}),
    enginePlan: assistantEnginePlan(params.intent as Parameters<typeof assistantEnginePlan>[0]),
    costPath: "deterministic_free",
    llmUsed: false,
    sensitiveAuthority: {
      directMutationAllowed: false,
      llmAuthority: false,
    },
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const parsed = await parseBrainRespondRequest(request.clone());

  if (!parsed.ok) {
    return legacyConversePost(request);
  }

  try {
    const { account, profiles, canonicalProfile } =
      await getAuthenticatedProfile(request);
    const { conversationId: requestedConversationId, message } = parsed.value;
    const serverLocale = await getServerKlyxLocale();
    const locale = normalizeAssistantLocale(serverLocale);

    let conversationState:
      | Awaited<ReturnType<typeof resolveAssistantConversation>>
      | null = null;

    if (requestedConversationId) {
      conversationState = await resolveAssistantConversation({
        requestedConversationId,
        profileIds: profiles.map((profile) => profile.id),
        canonicalProfileId: canonicalProfile.id,
        firstMessage: message,
      });
    }

    const route = routeAssistantIntent(message, {
      previousIntent: conversationState?.previousIntent ?? null,
      locale,
    });

    if (
      route.intent === "service_need" ||
      route.intent === "income_search" ||
      route.intent === "mission_management" ||
      route.intent === "clarification"
    ) {
      return legacyConversePost(request);
    }

    if (
      route.intent === "provider_help" &&
      detectOfferServicesIntent(message)
    ) {
      return offerServicesPost(request);
    }

    const deterministicFaq =
      route.intent === "information"
        ? deterministicInformation(message, locale)
        : null;

    if (route.intent === "information" && !deterministicFaq) {
      // AI is the last resort only after the zero-cost deterministic knowledge
      // layer misses. The legacy unified route keeps its existing safe AI path.
      return legacyConversePost(request);
    }

    const policy = API_RATE_LIMIT_POLICIES.brainRespond;
    const rateLimit = await consumeApiRateLimit(canonicalProfile.id, policy);
    if (!rateLimit.allowed) {
      return apiRateLimitExceededResponse(policy, rateLimit);
    }

    if (!conversationState) {
      conversationState = await resolveAssistantConversation({
        profileIds: profiles.map((profile) => profile.id),
        canonicalProfileId: canonicalProfile.id,
        firstMessage: message,
      });
    }

    let reply = "";
    let action: AssistantGroundedAction | undefined;
    let localeChange: AssistantLocale | undefined;
    const extra: Record<string, unknown> = {
      accountCapabilities: {
        requestServices: account.canRequestServices,
        offerServices: account.canOfferServices,
      },
    };

    if (route.intent === "account_help") {
      const help = accountHelp(message, locale);
      reply = help.reply;
      action = help.action;
      extra.topic = help.topic;
    } else if (route.intent === "booking_tracking") {
      const booking = await loadLatestAssistantBooking(profiles);
      reply = bookingTrackingReply(booking, locale);
      action = bookingAction(booking, locale);
      extra.booking = booking;
    } else if (route.intent === "payment_explanation") {
      const booking = await loadLatestAssistantBooking(profiles);
      reply = paymentReply(booking, locale);
      action = bookingAction(booking, locale);
      extra.booking = booking;
      extra.paymentMutationAllowed = false;
    } else if (route.intent === "refund_explanation") {
      const booking = await loadLatestAssistantBooking(profiles);
      reply = refundReply(booking, locale);
      action = bookingAction(booking, locale);
      extra.booking = booking;
      extra.refundMutationAllowed = false;
    } else if (route.intent === "provider_help") {
      const help = providerHelp(locale);
      reply = help.reply;
      action = help.action;
      extra.topic = help.topic;
    } else if (route.intent === "kyc_explanation") {
      const verification = await loadAssistantKyc(profiles);
      reply = kycReply(verification, locale);
      action = kycAction(locale);
      extra.kyc = verification;
      extra.kycDecisionAllowed = false;
      extra.eligibilityDecisionAllowed = false;
    } else if (route.intent === "locale_change") {
      const requestedLocale = detectRequestedAssistantLocale(message);
      if (requestedLocale) {
        localeChange = requestedLocale;
        reply = languageChangeReply(requestedLocale);
        extra.locale = requestedLocale;
      } else {
        reply = localize(locale, {
          fr: "Quelle langue veux-tu utiliser : français, anglais, néerlandais ou allemand ?",
          en: "Which language do you want to use: French, English, Dutch or German?",
          nl: "Welke taal wil je gebruiken: Frans, Engels, Nederlands of Duits?",
          de: "Welche Sprache möchtest du verwenden: Französisch, Englisch, Niederländisch oder Deutsch?",
        });
        extra.localeRequired = true;
      }
    } else if (route.intent === "information" && deterministicFaq) {
      reply = deterministicFaq.reply;
      action = deterministicFaq.action;
      extra.topic = deterministicFaq.topic;
    } else {
      return legacyConversePost(request);
    }

    const payload = safePayload({
      intent: route.intent,
      confidence: route.confidence,
      action,
      localeChange,
      extra,
    });

    await appendAssistantExchange({
      conversationId: conversationState.conversationId,
      userMessage: message,
      assistantReply: reply,
      payload,
    });

    const response = NextResponse.json(
      {
        conversationId: conversationState.conversationId,
        reply,
        payload,
        aiMode: "fallback",
        routedIntent: route.intent,
        deterministicSafety: true,
      },
      {
        headers: rateLimitResponseHeaders(policy, rateLimit),
      }
    );

    if (localeChange) {
      response.cookies.set(KLYX_LANGUAGE_COOKIE_KEY, localeChange, {
        path: "/",
        maxAge: 31_536_000,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assistant KLYX indisponible.";
    const status =
      message === "Conversation introuvable."
        ? 404
        : apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "assistant_gateway_failed",
      route: "/api/assistant/gateway",
      method: "POST",
      status,
      code: "KLYX_ASSISTANT_GATEWAY_FAILED",
      publicMessage: status < 500 ? message : undefined,
      details: {
        automaticSensitiveExecutionAllowed: false,
      },
      startedAt,
    });
  }
}
