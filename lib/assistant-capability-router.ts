export type KlyxAssistantCapability =
  | "klyx_information"
  | "account_profile"
  | "service_search"
  | "request_creation"
  | "booking_tracking"
  | "payment_explanation"
  | "refund_explanation"
  | "provider_help"
  | "kyc_explanation"
  | "language_change"
  | "legacy";

export type KlyxAssistantEngine =
  | "supabase"
  | "matching"
  | "sumsub"
  | "stripe"
  | "twilio"
  | "resend"
  | "tolgee"
  | "booking"
  | "refund"
  | "ledger"
  | "klyx_knowledge";

export type KlyxAssistantRisk =
  | "read_only"
  | "preference_mutation"
  | "sensitive_domain";

export type KlyxAssistantCostMode =
  | "deterministic_free"
  | "engine_read"
  | "llm_fallback";

export type KlyxAssistantCapabilityRoute = {
  capability: KlyxAssistantCapability;
  risk: KlyxAssistantRisk;
  costMode: KlyxAssistantCostMode;
  engines: readonly KlyxAssistantEngine[];
  delegateToLegacy: boolean;
  llmAllowed: boolean;
  targetLocale: "fr" | "en" | "nl" | "de" | null;
  wantsLiveStatus: boolean;
};

export const KLYX_ASSISTANT_ENGINE_CATALOG = {
  supabase: { authority: "account_data" },
  matching: { authority: "service_matching" },
  sumsub: { authority: "external_kyc_state" },
  stripe: { authority: "external_payment_state" },
  twilio: { authority: "communications_transport" },
  resend: { authority: "communications_transport" },
  tolgee: { authority: "translation_catalog" },
  booking: { authority: "booking_state" },
  refund: { authority: "refund_policy_and_execution" },
  ledger: { authority: "financial_truth" },
  klyx_knowledge: { authority: "product_information" },
} as const satisfies Record<KlyxAssistantEngine, { authority: string }>;

export const KLYX_LLM_FORBIDDEN_DECISIONS = [
  "payment",
  "kyc",
  "eligibility",
  "settlement",
  "refund",
  "sensitive_mutation",
] as const;

const LANGUAGE_ALIASES: ReadonlyArray<{
  locale: "fr" | "en" | "nl" | "de";
  pattern: RegExp;
}> = [
  {
    locale: "fr",
    pattern: /\b(?:fran[cç]ais|french|francais)\b/i,
  },
  {
    locale: "en",
    pattern: /\b(?:anglais|english|anglaise?)\b/i,
  },
  {
    locale: "nl",
    pattern: /\b(?:n[ée]erlandais|nederlands|dutch|flamand)\b/i,
  },
  {
    locale: "de",
    pattern: /\b(?:allemand|deutsch|german)\b/i,
  },
];

function targetLocale(message: string): "fr" | "en" | "nl" | "de" | null {
  if (
    !/\b(?:langue|language|taal|sprache|passe|passer|change|changer|switch|parle|speak|spreek|sprich)\b/i.test(
      message
    )
  ) {
    return null;
  }

  return LANGUAGE_ALIASES.find((item) => item.pattern.test(message))?.locale ?? null;
}

function isExplanation(message: string): boolean {
  return /\b(?:comment|pourquoi|explique|explication|fonctionne|c['’]?est quoi|qu['’]?est[- ]?ce que|how|why|explain|what is|hoe|waarom|wat is|wie|warum|was ist)\b/i.test(
    message
  );
}

function asksOwnStatus(message: string): boolean {
  return /\b(?:mon|ma|mes|my|mijn|meine|meiner|status|statut|o[ùu] en est|where is|waar staat|stand)\b/i.test(
    message
  );
}

export function routeKlyxAssistantCapability(
  rawMessage: string
): KlyxAssistantCapabilityRoute {
  const message = rawMessage.replace(/\s+/g, " ").trim();
  const locale = targetLocale(message);

  if (locale) {
    return {
      capability: "language_change",
      risk: "preference_mutation",
      costMode: "deterministic_free",
      engines: ["tolgee"],
      delegateToLegacy: false,
      llmAllowed: false,
      targetLocale: locale,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:kyc|kyb|sumsub|v[ée]rification d['’]?identit[ée]|identity verification|identiteitsverificatie|identit[aä]tspr[üu]fung)\b/i.test(
      message
    )
  ) {
    return {
      capability: "kyc_explanation",
      risk: "sensitive_domain",
      costMode: asksOwnStatus(message) ? "engine_read" : "deterministic_free",
      engines: ["sumsub", "supabase"],
      delegateToLegacy: false,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: asksOwnStatus(message),
    };
  }

  if (
    /\b(?:rembours(?:er|ement)|refund|terugbetaling|r[üu]ckerstattung)\b/i.test(message) &&
    isExplanation(message)
  ) {
    return {
      capability: "refund_explanation",
      risk: "sensitive_domain",
      costMode: "deterministic_free",
      engines: ["refund", "ledger", "stripe"],
      delegateToLegacy: false,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:paiement|payer|payment|stripe|betalen|betaling|zahlung|bezahlen)\b/i.test(message) &&
    isExplanation(message)
  ) {
    return {
      capability: "payment_explanation",
      risk: "sensitive_domain",
      costMode: "deterministic_free",
      engines: ["stripe", "ledger"],
      delegateToLegacy: false,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:compte|profil|profile|account|mon compte|mon profil|mijn account|mijn profiel|mein konto|mein profil)\b/i.test(
      message
    ) &&
    /\b(?:aide|modifier|voir|g[ée]rer|changer|help|edit|manage|bekijk|beheer|hilfe|bearbeiten|verwalten)\b/i.test(
      message
    )
  ) {
    return {
      capability: "account_profile",
      risk: "read_only",
      costMode: "deterministic_free",
      engines: ["supabase"],
      delegateToLegacy: false,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:ma r[ée]servation|mes r[ée]servations|booking|reservation|mission en cours|suivre|tracking|track|statut de ma mission|mijn boeking|mijn opdracht|meine buchung|mein auftrag)\b/i.test(
      message
    )
  ) {
    return {
      capability: "booking_tracking",
      risk: "read_only",
      costMode: "engine_read",
      engines: ["supabase", "booking", "stripe", "ledger"],
      delegateToLegacy: true,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: true,
    };
  }

  if (
    /\b(?:prestataire|proposer mes services|devenir prestataire|gagner de l['’]?argent|trouver des missions|provider|offer my services|find work|dienstverlener|opdrachten|anbieter|auftr[aä]ge)\b/i.test(
      message
    )
  ) {
    return {
      capability: "provider_help",
      risk: "sensitive_domain",
      costMode: "engine_read",
      engines: ["supabase", "matching", "sumsub", "stripe"],
      delegateToLegacy: true,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:cr[ée]er|publier|faire|ouvrir|lancer)\s+(?:une|ma)?\s*demande\b/i.test(message) ||
    /\b(?:create|post|publish)\s+(?:a|my)?\s*request\b/i.test(message)
  ) {
    return {
      capability: "request_creation",
      risk: "sensitive_domain",
      costMode: "engine_read",
      engines: ["supabase", "matching"],
      delegateToLegacy: true,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:trouve(?:r)?|cherche(?:r)?|recherche|find|search|zoek|zoeken|suche|finden)\b/i.test(message) &&
    /\b(?:service|prestataire|quelqu['’]?un|personne|pro|provider|professional|dienst|iemand|dienstverlener|service|jemand|anbieter)\b/i.test(
      message
    )
  ) {
    return {
      capability: "service_search",
      risk: "read_only",
      costMode: "engine_read",
      engines: ["supabase", "matching"],
      delegateToLegacy: true,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  if (
    /\b(?:klyx)\b/i.test(message) &&
    (isExplanation(message) || /\b(?:prix|co[uû]t|frais|s[ée]curit[ée]|trust|fonctionnalit[ée]s?|services?)\b/i.test(message))
  ) {
    return {
      capability: "klyx_information",
      risk: "read_only",
      costMode: "deterministic_free",
      engines: ["klyx_knowledge"],
      delegateToLegacy: false,
      llmAllowed: false,
      targetLocale: null,
      wantsLiveStatus: false,
    };
  }

  return {
    capability: "legacy",
    risk: "read_only",
    costMode: "llm_fallback",
    engines: ["klyx_knowledge"],
    delegateToLegacy: true,
    llmAllowed: true,
    targetLocale: null,
    wantsLiveStatus: false,
  };
}
