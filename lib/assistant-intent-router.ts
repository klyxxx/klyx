export type AssistantIntent =
  | "service_need"
  | "income_search"
  | "mission_management"
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
  { pattern: /\bma mission|mon service|ma r[ée]servation|mon rendez[- ]?vous\b/i, weight: 5 },
  { pattern: /\bmission (?:en cours|existante|confirm[ée]e|pay[ée]e)\b/i, weight: 5 },
  { pattern: /\bo[ùu] en est|quel est le statut|suivre (?:ma|la) mission\b/i, weight: 5 },
  { pattern: /\bannul(?:er|e)|reporter|d[ée]placer|modifier\b/i, weight: 2 },
  { pattern: /\bpaiement (?:de|pour) (?:ma|la) mission|remboursement\b/i, weight: 4 },
  { pattern: /\bmy (?:mission|booking|appointment)|track my|cancel my|reschedule my\b/i, weight: 5 },
  { pattern: /\bmijn (?:opdracht|boeking)|mijn afspraak|annuleer mijn\b/i, weight: 5 },
  { pattern: /\bmeine(?:n|r)? (?:auftrag|buchung|termin)|meinen termin\b/i, weight: 5 },
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
    return "Do you want KLYX to find a service for you, find paid work, or manage an existing mission?";
  }

  if (locale === "nl") {
    return "Wil je dat KLYX een dienst voor je vindt, betaalde opdrachten zoekt of een bestaande opdracht beheert?";
  }

  if (locale === "de") {
    return "Soll KLYX einen Service für dich finden, bezahlte Aufträge suchen oder einen bestehenden Auftrag verwalten?";
  }

  return "Tu veux que KLYX trouve un service, cherche des missions rémunérées ou gère une mission existante ?";
}

function confidenceFor(top: number, second: number): AssistantIntentRoute["confidence"] {
  if (top >= 7 && top - second >= 3) return "high";
  if (top >= 4 && top - second >= 2) return "medium";
  return "low";
}

function hasExplicitNewDirection(scores: AssistantIntentRoute["scores"]): boolean {
  return (
    scores.service_need >= 4 ||
    scores.income_search >= 4 ||
    scores.mission_management >= 4 ||
    scores.information >= 4
  );
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
