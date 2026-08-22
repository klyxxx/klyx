import type { ServiceCandidate } from "@/lib/universal-service-request";

export type CatalogServiceRecord = {
  slug: string;
  name: string | null;
};

export type CatalogServiceDecision = {
  selected: ServiceCandidate | null;
  ambiguous: boolean;
  confidenceGap: number | null;
  clarificationCandidates: ServiceCandidate[];
};

export const CATALOG_SERVICE_MIN_CONFIDENCE = 60;
export const CATALOG_SERVICE_MIN_DECISION_GAP = 12;

const GENERIC_SERVICE_TOKENS = new Set([
  "aide",
  "autre",
  "cours",
  "creation",
  "domicile",
  "general",
  "generale",
  "gestion",
  "installation",
  "nettoyage",
  "pose",
  "professionnel",
  "professionnelle",
  "reparation",
  "service",
  "services",
  "transport",
  "entretien",
]);

const STOP_TOKENS = new Set([
  "aux",
  "avec",
  "chez",
  "dans",
  "des",
  "pour",
  "sur",
  "une",
  "les",
  "par",
]);

type ControlledSynonymGroup = {
  serviceTerms: readonly string[];
  requestTerms: readonly string[];
};

// Deliberately small, reviewable and language-specific. These groups are not a
// free-form fuzzy classifier: a service must itself contain a controlled
// service term before a request synonym can improve its score.
export const CONTROLLED_SERVICE_SYNONYMS: readonly ControlledSynonymGroup[] = [
  {
    serviceTerms: ["baby sitting", "babysitter", "garde enfant", "nounou"],
    requestTerms: [
      "baby sitter",
      "babysitter",
      "nounou",
      "garder mon enfant",
      "garder mes enfants",
      "garde d enfant",
      "garde enfants",
    ],
  },
  {
    serviceTerms: ["menage", "nettoyage", "aide menagere"],
    requestTerms: [
      "menage",
      "nettoyer",
      "nettoyage",
      "femme de menage",
      "aide menagere",
      "faire le propre",
    ],
  },
  {
    serviceTerms: ["demenagement", "demenageur"],
    requestTerms: [
      "demenager",
      "demenagement",
      "demenageur",
      "porter des cartons",
      "transport de meubles",
      "camion de demenagement",
    ],
  },
  {
    serviceTerms: ["bricolage", "bricoleur", "handyman", "montage meuble"],
    requestTerms: [
      "bricolage",
      "bricoleur",
      "handyman",
      "monter un meuble",
      "monter des meubles",
      "fixer une etagere",
      "petite reparation",
    ],
  },
  {
    serviceTerms: ["plomberie", "plombier"],
    requestTerms: [
      "plombier",
      "plomberie",
      "fuite d eau",
      "robinet fuit",
      "robinet qui fuit",
      "evier bouche",
      "canalisation bouchee",
    ],
  },
  {
    serviceTerms: ["electricite", "electricien"],
    requestTerms: [
      "electricien",
      "electricite",
      "prise electrique",
      "court circuit",
      "tableau electrique",
      "cablage electrique",
    ],
  },
  {
    serviceTerms: ["serrurerie", "serrurier"],
    requestTerms: [
      "serrurier",
      "serrure bloquee",
      "porte bloquee",
      "cle cassee",
      "cle perdue",
    ],
  },
  {
    serviceTerms: ["jardinage", "jardinier"],
    requestTerms: [
      "jardinier",
      "jardinage",
      "tondre la pelouse",
      "tonte pelouse",
      "tailler une haie",
      "entretien jardin",
    ],
  },
  {
    serviceTerms: ["peinture", "peintre"],
    requestTerms: [
      "peintre",
      "peindre un mur",
      "peindre les murs",
      "repeindre",
      "peinture murale",
    ],
  },
  {
    serviceTerms: ["chauffage", "chauffagiste"],
    requestTerms: [
      "chauffagiste",
      "chauffage en panne",
      "radiateur froid",
      "chaudiere en panne",
      "entretien chaudiere",
    ],
  },
] as const;

export function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeCatalogText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOP_TOKENS.has(token)
    );
}

function tokensAreRelated(
  first: string,
  second: string
): boolean {
  if (first === second) return true;

  if (first.length < 5 || second.length < 5) {
    return false;
  }

  return first.slice(0, 5) === second.slice(0, 5);
}

function hasRelatedToken(
  needle: string,
  haystack: readonly string[]
): boolean {
  return haystack.some((token) =>
    tokensAreRelated(needle, token)
  );
}

function controlledSynonymScore(
  normalizedText: string,
  normalizedService: string
): number {
  let best = 0;

  for (const group of CONTROLLED_SERVICE_SYNONYMS) {
    const serviceMatches = group.serviceTerms.some((term) =>
      normalizedService.includes(normalizeCatalogText(term))
    );

    if (!serviceMatches) continue;

    const matchingTerms = group.requestTerms.filter((term) =>
      normalizedText.includes(normalizeCatalogText(term))
    ).length;

    if (matchingTerms > 0) {
      best = Math.max(best, Math.min(94, 82 + (matchingTerms - 1) * 4));
    }
  }

  return best;
}

function scoreService(
  normalizedText: string,
  textTokens: readonly string[],
  service: CatalogServiceRecord
): number {
  const label = service.name?.trim() || service.slug;
  const normalizedLabel = normalizeCatalogText(label);
  const normalizedSlug = normalizeCatalogText(service.slug);
  const normalizedService = `${normalizedLabel} ${normalizedSlug}`.trim();

  if (!normalizedLabel) return 0;

  if (
    normalizedText.includes(normalizedLabel) ||
    (normalizedSlug.length >= 4 &&
      normalizedText.includes(normalizedSlug))
  ) {
    return 100;
  }

  const synonymScore = controlledSynonymScore(
    normalizedText,
    normalizedService
  );
  const serviceTokens = tokens(label);
  const informativeTokens = serviceTokens.filter(
    (token) => !GENERIC_SERVICE_TOKENS.has(token)
  );

  if (informativeTokens.length === 0) {
    const genericMatches = serviceTokens.filter((token) =>
      hasRelatedToken(token, textTokens)
    ).length;

    return Math.max(
      synonymScore,
      genericMatches > 0 ? 65 : 0
    );
  }

  const informativeMatches = informativeTokens.filter((token) =>
    hasRelatedToken(token, textTokens)
  ).length;

  if (informativeMatches === 0) return synonymScore;

  const exactInformativeMatches = informativeTokens.filter((token) =>
    textTokens.includes(token)
  ).length;

  const ratio =
    informativeMatches / informativeTokens.length;

  let score = 55 + Math.round(ratio * 35);

  // Prefer the exact profession/service word over a merely related stem.
  score += Math.min(6, exactInformativeMatches * 4);

  const actionMatches = serviceTokens.filter(
    (token) =>
      GENERIC_SERVICE_TOKENS.has(token) &&
      hasRelatedToken(token, textTokens)
  ).length;

  score += Math.min(8, actionMatches * 4);

  if (
    informativeMatches >= 2 &&
    ratio >= 0.5
  ) {
    score += 3;
  }

  return Math.max(synonymScore, Math.min(99, score));
}

export function detectCatalogServiceCandidates(
  text: string,
  services: readonly CatalogServiceRecord[],
  limit = 3
): ServiceCandidate[] {
  const normalizedText = normalizeCatalogText(text);

  if (!normalizedText || services.length === 0) {
    return [];
  }

  const textTokens = tokens(text);

  return services
    .map((service) => {
      const confidence = scoreService(
        normalizedText,
        textTokens,
        service
      );

      return {
        slug: service.slug,
        label: service.name?.trim() || service.slug,
        confidence,
        reason:
          confidence === 100
            ? "Le métier est explicitement mentionné dans la demande."
            : controlledSynonymScore(
                  normalizedText,
                  `${normalizeCatalogText(service.name?.trim() || service.slug)} ${normalizeCatalogText(service.slug)}`
                ) >= confidence
              ? "Un synonyme contrôlé KLYX correspond à ce métier."
              : "Le besoin correspond au catalogue de métiers KLYX.",
      } satisfies ServiceCandidate;
    })
    .filter(
      (candidate) =>
        candidate.confidence >= CATALOG_SERVICE_MIN_CONFIDENCE
    )
    .sort((first, second) => {
      if (second.confidence !== first.confidence) {
        return second.confidence - first.confidence;
      }

      return first.label.localeCompare(second.label, "fr");
    })
    .slice(0, Math.max(1, limit));
}

export function mergeServiceCandidates(
  services: readonly CatalogServiceRecord[],
  ...candidateGroups: readonly ServiceCandidate[][]
): ServiceCandidate[] {
  const serviceBySlug = new Map(
    services.map((service) => [service.slug, service])
  );
  const merged = new Map<string, ServiceCandidate>();

  for (const group of candidateGroups) {
    for (const candidate of group) {
      const service = serviceBySlug.get(candidate.slug);

      if (!service) continue;

      const normalizedCandidate = {
        ...candidate,
        label: service.name?.trim() || candidate.label,
      };
      const current = merged.get(candidate.slug);

      if (
        !current ||
        normalizedCandidate.confidence > current.confidence
      ) {
        merged.set(candidate.slug, normalizedCandidate);
      }
    }
  }

  return [...merged.values()]
    .sort((first, second) => {
      if (second.confidence !== first.confidence) {
        return second.confidence - first.confidence;
      }

      return first.label.localeCompare(second.label, "fr");
    })
    .slice(0, 3);
}

export function resolveCatalogServiceDecision(
  candidates: readonly ServiceCandidate[]
): CatalogServiceDecision {
  const top = candidates[0] ?? null;
  const second = candidates[1] ?? null;

  if (!top || top.confidence < CATALOG_SERVICE_MIN_CONFIDENCE) {
    return {
      selected: null,
      ambiguous: false,
      confidenceGap: null,
      clarificationCandidates: [],
    };
  }

  if (!second) {
    return {
      selected: top,
      ambiguous: false,
      confidenceGap: null,
      clarificationCandidates: [],
    };
  }

  const confidenceGap = top.confidence - second.confidence;
  const ambiguous =
    second.confidence >= CATALOG_SERVICE_MIN_CONFIDENCE &&
    confidenceGap < CATALOG_SERVICE_MIN_DECISION_GAP;

  return {
    selected: ambiguous ? null : top,
    ambiguous,
    confidenceGap,
    clarificationCandidates: ambiguous
      ? [top, second, ...candidates.slice(2)].slice(0, 3)
      : [],
  };
}
