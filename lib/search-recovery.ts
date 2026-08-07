import type {
  ProviderSearchItem,
  ProviderSearchResponse,
} from "@/lib/provider-search";

export type SearchRecoveryFilters = {
  service: string;
  city: string;
  date: string;
  time: string;
  duration: string;
  budget: string;
  pricing: string;
  sort: string;
};

export type SearchRecoverySuggestion = {
  id:
    | "remove_budget"
    | "raise_budget"
    | "remove_time"
    | "remove_date"
    | "remove_city"
    | "remove_pricing"
    | "shorter_duration"
    | "show_all";
  title: string;
  description: string;
  priority: number;
  nextFilters: SearchRecoveryFilters;
};

function cloneFilters(
  filters: SearchRecoveryFilters
): SearchRecoveryFilters {
  return { ...filters };
}

function providerPriceEstimate(
  provider: ProviderSearchItem,
  durationHours: number
): number | null {
  if (provider.price === null) return null;

  return provider.pricingType === "hourly"
    ? provider.price * durationHours
    : provider.price;
}

function lowestEstimatedPrice(
  providers: ProviderSearchItem[],
  durationHours: number
): number | null {
  const values = providers
    .map((provider) =>
      providerPriceEstimate(provider, durationHours)
    )
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value)
    )
    .sort((first, second) => first - second);

  return values[0] ?? null;
}

export function buildSearchRecoverySuggestions(
  filters: SearchRecoveryFilters,
  result: ProviderSearchResponse
): SearchRecoverySuggestion[] {
  const suggestions: SearchRecoverySuggestion[] = [];
  const durationHours = Math.max(
    1,
    Number(filters.duration) || 1
  );

  if (filters.budget) {
    const currentBudget = Number(filters.budget);
    const cheapest = lowestEstimatedPrice(
      result.providers,
      durationHours
    );

    if (
      Number.isFinite(currentBudget) &&
      cheapest !== null &&
      cheapest > currentBudget
    ) {
      const next = cloneFilters(filters);
      next.budget = String(Math.ceil(cheapest));

      suggestions.push({
        id: "raise_budget",
        title: `Augmenter le budget à ${Math.ceil(cheapest)} €`,
        description:
          "C’est le budget minimum estimé parmi les alternatives actuellement trouvées.",
        priority: 100,
        nextFilters: next,
      });
    }

    const next = cloneFilters(filters);
    next.budget = "";

    suggestions.push({
      id: "remove_budget",
      title: "Retirer temporairement le budget maximum",
      description:
        "KLYX gardera les prix visibles pour que tu puisses comparer avant de réserver.",
      priority: 80,
      nextFilters: next,
    });
  }

  if (filters.time) {
    const next = cloneFilters(filters);
    next.time = "";
    next.duration = "1";

    suggestions.push({
      id: "remove_time",
      title: "Chercher toute la journée",
      description:
        "Conserve la date mais laisse KLYX afficher les prestataires disponibles à d’autres heures.",
      priority: 95,
      nextFilters: next,
    });
  }

  if (filters.date) {
    const next = cloneFilters(filters);
    next.date = "";
    next.time = "";
    next.duration = "1";

    suggestions.push({
      id: "remove_date",
      title: "Retirer la date précise",
      description:
        "Affiche les prestataires du service sans imposer un jour particulier.",
      priority: 65,
      nextFilters: next,
    });
  }

  if (
    filters.time &&
    Number(filters.duration) > 1
  ) {
    const next = cloneFilters(filters);
    next.duration = "1";

    suggestions.push({
      id: "shorter_duration",
      title: "Tester une durée d’1 heure",
      description:
        "Un créneau plus court peut faire apparaître davantage de disponibilités.",
      priority: 75,
      nextFilters: next,
    });
  }

  if (filters.pricing !== "all") {
    const next = cloneFilters(filters);
    next.pricing = "all";

    suggestions.push({
      id: "remove_pricing",
      title: "Accepter tous les types de tarifs",
      description:
        "Inclut les prestataires au forfait et au tarif horaire.",
      priority: 55,
      nextFilters: next,
    });
  }

  if (filters.city) {
    const next = cloneFilters(filters);
    next.city = "";

    suggestions.push({
      id: "remove_city",
      title: "Élargir à toutes les zones",
      description:
        "Utile si aucun prestataire n’est encore publié dans la zone saisie.",
      priority: 45,
      nextFilters: next,
    });
  }

  const showAll = cloneFilters(filters);
  showAll.city = "";
  showAll.date = "";
  showAll.time = "";
  showAll.duration = "1";
  showAll.budget = "";
  showAll.pricing = "all";

  suggestions.push({
    id: "show_all",
    title: "Voir tous les prestataires de ce service",
    description:
      "Conserve seulement le service demandé et retire les contraintes commerciales.",
    priority: 20,
    nextFilters: showAll,
  });

  const unique = new Map<
    SearchRecoverySuggestion["id"],
    SearchRecoverySuggestion
  >();

  for (const suggestion of suggestions) {
    if (!unique.has(suggestion.id)) {
      unique.set(suggestion.id, suggestion);
    }
  }

  return [...unique.values()]
    .sort(
      (first, second) =>
        second.priority - first.priority
    )
    .slice(0, 5);
}

export function recoveryHref(
  filters: SearchRecoveryFilters
): string {
  const params = new URLSearchParams();

  if (filters.service !== "all") {
    params.set("service", filters.service);
  }

  if (filters.city.trim()) {
    params.set("city", filters.city.trim());
  }

  if (filters.date) {
    params.set("date", filters.date);
  }

  if (filters.time) {
    params.set("time", filters.time);
    params.set(
      "duration",
      filters.duration || "1"
    );
  }

  if (
    filters.budget &&
    Number(filters.budget) >= 0
  ) {
    params.set("budget", filters.budget);
  }

  if (filters.pricing !== "all") {
    params.set("pricing", filters.pricing);
  }

  if (
    filters.sort &&
    filters.sort !== "recommended"
  ) {
    params.set("sort", filters.sort);
  }

  const query = params.toString();

  return query ? `/search?${query}` : "/search";
}
