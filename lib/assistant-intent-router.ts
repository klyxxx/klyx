export type AssistantIntent =
  | "service_need"
  | "income_search"
  | "mission_management"
  | "account_help"
  | "booking_tracking"
  | "payment_explanation"
  | "refund_explanation"
  | "provider_help"
  | "kyc_explanation"
  | "locale_change"
  | "information"
  | "clarification";

export type AssistantIntentRoute = {
  intent: AssistantIntent;
  confidence: "high" | "medium" | "low";
  scores: Record<Exclude<AssistantIntent, "clarification">, number>;
  clarificationQuestion: string | null;
};

type RouteOptions = {
  previousIntent?: AssistantIntent | null;
  locale?: string | null;
};

type Signal = {
  pattern: RegExp;
  weight: number;
};

const SERVICE_SIGNALS: readonly Signal[] = [
  { pattern: /^\s*(?:un|le|du)?\s*service\s*$/i, weight: 7 },
  { pattern: /^\s*(?:a|the)?\s*service\s*$/i, weight: 7 },
  { pattern: /\btrouve(?:r)?[- ]?moi\b/i, weight: 5 },
  { pattern: /\bcherche(?:r)?\s+(?:quelqu['’]?un|une personne|un pro|un prestataire)\b/i, weight: 5 },
  { pattern: /\bj['’]?ai besoin (?:de|d['’])\b/i, weight: 4 },
  { pattern: /\bbesoin d['’]?un(?:e)?\s+(?:service|personne|pro|prestataire)\b/i, weight: 4 },
  { pattern: /\br[ée]server?\b/i, weight: 3 },
  { pattern: /\bfaire venir\b/i, weight: 3 },
  { pattern: /\bnettoy(?:er|age)|m[ée]nage|d[ée]m[ée]nag(?:er|ement)|bricolage|babysitt(?:er|ing)|monter (?:un|une|mon|ma)|r[ée]parer\b/i, weight: 3 },
  { pattern: /\bfind (?:me )?(?:someone|a professional|a provider)\b/i, weight: 5 },
  { pattern: /\bi need (?:someone|help with|a service)\b/i, weight: 4 },
  { pattern: /\bbook (?:someone|a service|a professional)\b/i, weight: 4 },
  { pattern: /\bzoek (?:iemand|een vakman)|ik heb .* nodig\b/i, weight: 4 },
  { pattern: /\bfinde? (?:jemanden|einen handwerker)|ich brauche\b/i, weight: 4 },
];

const INCOME_SIGNALS: readonly Signal[] = [
  { pattern: /^\s*(?:des|les)?\s*missions?(?:\s+r[ée]mun[ée]r[ée]es?)?\s*$/i, weight: 7 },
  { pattern: /^\s*(?:du|un)?\s*(?:travail|revenu)\s*$/i, weight: 7 },
  { pattern: /^\s*(?:paid\s+)?(?:work|jobs?|missions?)\s*$/i, weight: 7 },
  { pattern: /\bje (?:veux|voudrais|souhaite) gagner\b/i, weight: 6 },
  { pattern: /\bgagner\s+(?:environ\s+)?\d+/i, weight: 5 },
  { pattern: /\bgagner de l['’]?argent|compl[ée]ment de revenu|revenu suppl[ée]mentaire\b/i, weight: 5 },
  { pattern: /\bje suis (?:libre|disponible)\b/i, weight: 4 },
  { pattern: /\bmissions? (?:disponibles?|pay[ée]es?|r[ée]mun[ée]r[ée]es?)\b/i, weight: 5 },
  { pattern: /\btrouver? (?:des )?missions?\b/i, weight: 4 },
  { pattern: /\btravailler (?:samedi|dimanche|ce soir|demain|pr[èe]s de chez moi)\b/i, weight: 3 },
  { pattern: /\bi (?:want|would like) to earn\b/i, weight: 6 },
  { pattern: /\bi(?:'m| am) (?:free|available)\b/i, weight: 4 },
  { pattern: /\bfind (?:me )?(?:work|jobs?|paid missions?)\b/i, weight: 5 },
  { pattern: /\bik wil .*verdienen|ik ben (?:vrij|beschikbaar)|opdrachten? zoeken\b/i, weight: 5 },
  { pattern: /\bich will .*verdienen|ich bin (?:frei|verf[üu]gbar)|auftr[äa]ge finden\b/i, weight: 5 },
];

const MANAGEMENT_SIGNALS: readonly Signal[] = [
  { pattern: /^\s*(?:g[ée]rer|suivre)\s+(?:une|ma|la)?\s*mission\s*$/i, weight: 7 },
  { pattern: /^\s*(?:manage|track)\s+(?:a|my|the)?\s*mission\s*$/i, weight: 7 },
  { pattern: /\bma mission|mon service|mon rendez[- ]?vous\b/i, weight: 5 },
  { pattern: /\bmission (?:en cours|existante|confirm[ée]e|pay[ée]e)\b/i, weight: 5 },
  { pattern: /\bsuivre (?:ma|la) mission\b/i, weight: 5 },
  { pattern: /\bannul(?:er|e)|reporter|d[ée]placer|modifier\b/i, weight: 2 },
  { pattern: /\bmy (?:mission|appointment)|track my mission|cancel my|reschedule my\b/i, weight: 5 },
  { pattern: /\bmijn (?:opdracht)|mijn afspraak|annuleer mijn\b/i, weight: 5 },
  { pattern: /\bmeine(?:n|r)? (?:auftrag|termin)|meinen termin\b/i, weight: 5 },
];

const ACCOUNT_SIGNALS: readonly Signal[] = [
  { pattern: /^\s*(?:mon|mes|my|mijn|mein)\s+(?:compte|profil|profils|account|profile|profiel|konto)\s*$/i, weight: 8 },
  { pattern: /\b(?:compte|profil|account|profile|profiel|konto)\b.*\b(?:changer|modifier|g[ée]rer|switch|manage|wijzig|wechsel|verwalten)\b/i, weight: 6 },
  { pattern: /\b(?:changer|switch|wissel|wechsel)\b.*\b(?:profil|profile|compte|account|profiel|konto)\b/i, weight: 7 },
  { pattern: /\bparam[èe]tres?|settings|instellingen|einstellungen|confidentialit[ée]|privacy\b/i, weight: 5 },
  { pattern: /\bmes informations|account details|account information|kontogegevens|kontodaten\b/i, weight: 5 },
];

const BOOKING_SIGNALS: readonly Signal[] = [
  { pattern: /\b(?:ma|la|mes) r[ée]servation(?:s)?\b/i, weight: 7 },
  { pattern: /\b(?:my|the) booking\b/i, weight: 7 },
  { pattern: /\bmijn boeking|meine buchung\b/i, weight: 7 },
  { pattern: /\bo[ùu] en est (?:ma|la) r[ée]servation\b/i, weight: 8 },
  { pattern: /\bstatut (?:de )?(?:ma|la) r[ée]servation\b/i, weight: 8 },
  { pattern: /\btrack (?:my|the) booking|booking status\b/i, weight: 8 },
  { pattern: /\bboeking volgen|status van mijn boeking|buchung verfolgen|status meiner buchung\b/i, weight: 8 },
];

const PAYMENT_SIGNALS: readonly Signal[] = [
  { pattern: /\b(?:comment|how|hoe|wie)\b.*\b(?:paiement|payer|payment|betalen|betaling|zahlung|bezahlen)\b/i, weight: 8 },
  { pattern: /\b(?:paiement|payment|betaling|zahlung)\b.*\b(?:fonctionne|marche|status|statut|expliquer|explain|werkt|funktioniert)\b/i, weight: 8 },
  { pattern: /^\s*(?:paiement|payment|betaling|zahlung)\s*\??$/i, weight: 7 },
  { pattern: /\b(?:pourquoi|why|waarom|warum)\b.*\b(?:paiement|payment|betaling|zahlung)\b/i, weight: 7 },
];

const REFUND_SIGNALS: readonly Signal[] = [
  { pattern: /\bremboursement|rembours[ée]|refund|terugbetaling|r[üu]ckerstattung\b/i, weight: 7 },
  { pattern: /\b(?:comment|how|hoe|wie)\b.*\b(?:rembours|refund|terugbetaal|r[üu]ckerstatt)\w*/i, weight: 3 },
];

const PROVIDER_SIGNALS: readonly Signal[] = [
  { pattern: /\b(?:devenir|etre|être) prestataire\b/i, weight: 8 },
  { pattern: /\b(?:proposer|offrir|vendre) (?:mes|des) services\b/i, weight: 8 },
  { pattern: /\bespace prestataire|profil prestataire|provider (?:area|profile)|dienstverlener|anbieter(?:bereich|profil)\b/i, weight: 7 },
  { pattern: /\b(?:help|aide|aider).*(?:prestataire|provider|dienstverlener|anbieter)\b/i, weight: 6 },
];

const KYC_SIGNALS: readonly Signal[] = [
  { pattern: /\bkyc\b/i, weight: 9 },
  { pattern: /\bsumsub\b/i, weight: 9 },
  { pattern: /\bv[ée]rification d['’ ]identit[ée]|identity verification|identiteitsverificatie|identit[äa]tspr[üu]fung\b/i, weight: 8 },
  { pattern: /\b(?:v[ée]rifier|verify|verifieer|pr[üu]fen).*(?:identit[ée]|identity|identiteit|identit[äa]t)\b/i, weight: 7 },
];

const LOCALE_SIGNALS: readonly Signal[] = [
  { pattern: /\b(?:change|changer|mets?|passe|switch|set|zet|stel|wechsel|stell).*(?:langue|language|taal|sprache)\b/i, weight: 9 },
  { pattern: /\b(?:en|to|naar|auf)\s+(?:fran[cç]ais|french|anglais|english|n[ée]erlandais|nederlands|dutch|allemand|deutsch|german)\b/i, weight: 5 },
  { pattern: /^\s*(?:fran[cç]ais|french|anglais|english|n[ée]erlandais|nederlands|dutch|allemand|deutsch|german)\s*$/i, weight: 4 },
];

const INFORMATION_SIGNALS: readonly Signal[] = [
  { pattern: /^\s*(?:une?|de l['’]?)?\s*(?:question|information|info)\s*$/i, weight: 7 },
  { pattern: /^\s*(?:a\s+)?(?:question|information)\s*$/i, weight: 7 },
  { pattern: /^\s*(?:comment|pourquoi|combien|qu['’]?est[- ]?ce que|c['’]?est quoi|est[- ]?ce que)\b/i, weight: 4 },
  { pattern: /\bcomment fonctionne KLYX\b/i, weight: 5 },
  { pattern: /\bexplique[- ]?moi|peux[- ]?tu m['’]?expliquer\b/i, weight: 4 },
  { pattern: /^\s*(?:how|why|what|when|where|can you explain|what is)\b/i, weight: 4 },
  { pattern: /^\s*(?:hoe|waarom|wat|wanneer|waar)\b/i, weight: 4 },
  { pattern: /^\s*(?:wie|warum|was|wann|wo|wie funktioniert)\b/i, weight: 4 },
];

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function score(value: string, signals: readonly Signal[]): number {
  return signals.reduce(
    (total, signal) => total + (signal.pattern.test(value) ? signal.weight : 0),
    0
  );
}

function question(locale: string | null | undefined): string {
  if (locale === "en") {
    return "Do you want KLYX to find a service, manage a booking or account, explain a payment, or help you earn with KLYX?";
  }

  if (locale === "nl") {
    return "Wil je dat KLYX een dienst vindt, een boeking of account beheert, een betaling uitlegt of je helpt verdienen met KLYX?";
  }

  if (locale === "de") {
    return "Soll KLYX einen Service finden, eine Buchung oder ein Konto verwalten, eine Zahlung erklären oder dir beim Verdienen mit KLYX helfen?";
  }

  return "Tu veux que KLYX trouve un service, gère une réservation ou ton compte, explique un paiement, ou t’aide à gagner avec KLYX ?";
}

function confidenceFor(top: number, second: number): AssistantIntentRoute["confidence"] {
  if (top >= 7 && top - second >= 3) return "high";
  if (top >= 4 && top - second >= 2) return "medium";
  return "low";
}

function hasExplicitNewDirection(scores: AssistantIntentRoute["scores"]): boolean {
  return Object.values(scores).some((value) => value >= 4);
}

export function routeAssistantIntent(
  rawMessage: string,
  options: RouteOptions = {}
): AssistantIntentRoute {
  const message = normalize(rawMessage);
  const scores: AssistantIntentRoute["scores"] = {
    service_need: score(message, SERVICE_SIGNALS),
    income_search: score(message, INCOME_SIGNALS),
    mission_management: score(message, MANAGEMENT_SIGNALS),
    account_help: score(message, ACCOUNT_SIGNALS),
    booking_tracking: score(message, BOOKING_SIGNALS),
    payment_explanation: score(message, PAYMENT_SIGNALS),
    refund_explanation: score(message, REFUND_SIGNALS),
    provider_help: score(message, PROVIDER_SIGNALS),
    kyc_explanation: score(message, KYC_SIGNALS),
    locale_change: score(message, LOCALE_SIGNALS),
    information: score(message, INFORMATION_SIGNALS),
  };

  if (
    options.previousIntent &&
    options.previousIntent !== "clarification" &&
    message.length <= 80 &&
    !hasExplicitNewDirection(scores)
  ) {
    return {
      intent: options.previousIntent,
      confidence: "high",
      scores,
      clarificationQuestion: null,
    };
  }

  const ranked = (Object.entries(scores) as Array<[
    Exclude<AssistantIntent, "clarification">,
    number,
  ]>).sort((left, right) => right[1] - left[1]);
  const [bestIntent, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;

  if (bestScore === 0) {
    const looksLikeQuestion =
      message.endsWith("?") ||
      /^\s*(?:qui|que|quoi|who|what)\b/i.test(message);

    if (looksLikeQuestion) {
      return {
        intent: "information",
        confidence: "low",
        scores,
        clarificationQuestion: null,
      };
    }

    return {
      intent: "clarification",
      confidence: "low",
      scores,
      clarificationQuestion: question(options.locale),
    };
  }

  if (bestScore - secondScore <= 1 && secondScore >= 3) {
    return {
      intent: "clarification",
      confidence: "low",
      scores,
      clarificationQuestion: question(options.locale),
    };
  }

  return {
    intent: bestIntent,
    confidence: confidenceFor(bestScore, secondScore),
    scores,
    clarificationQuestion: null,
  };
}
