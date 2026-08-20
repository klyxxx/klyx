import type { ServiceCandidate } from "@/lib/universal-service-request";

export type CatalogServiceRecord = {
  slug: string;
  name: string | null;
};

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

function scoreService(
  normalizedText: string,
  textTokens: readonly string[],
  service: CatalogServiceRecord
): number {
  const label = service.name?.trim() || service.slug;
  const normalizedLabel = normalizeCatalogText(label);
  const normalizedSlug = normalizeCatalogText(service.slug);

  if (!normalizedLabel) return 0;

  if (
    normalizedText.includes(normalizedLabel) ||
    (normalizedSlug.length >= 4 &&
      normalizedText.includes(normalizedSlug))
  ) {
    return 100;
  }

  const serviceTokens = tokens(label);
  const informativeTokens = serviceTokens.filter(
    (token) => !GENERIC_SERVICE_TOKENS.has(token)
  );

  if (informativeTokens.length === 0) {
    const genericMatches = serviceTokens.filter((token) =>
      hasRelatedToken(token, textTokens)
    ).length;

    return genericMatches > 0 ? 65 : 0;
  }

  const informativeMatches = informativeTokens.filter(
    (token) => hasRelatedToken(token, textTokens)
  ).length;

  if (informativeMatches === 0) return 0;

  const ratio =
    informativeMatches / informativeTokens.length;

  let score = 55 + Math.round(ratio * 35);

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

  return Math.min(99, score);
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
            : "Le besoin correspond au catalogue de métiers KLYX.",
      } satisfies ServiceCandidate;
    })
    .filter((candidate) => candidate.confidence >= 60)
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
