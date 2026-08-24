import type { KlyxLocale } from "./klyx-i18n";
import {
  formatKlyxSearchRecoveryRaiseBudgetTitle,
  translateKlyxSearchRecovery,
} from "./klyx-search-recovery-i18n";
import type {
  ProviderSearchItem,
  ProviderSearchResponse,
} from "@/lib/provider-search";

export type SearchRecoveryFilters = {
  service: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
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

function cloneFilters(filters: SearchRecoveryFilters): SearchRecoveryFilters {
  return { ...filters };
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function durationHours(filters: SearchRecoveryFilters): number {
  const start = timeToMinutes(filters.startTime);
  const end = timeToMinutes(filters.endTime);

  if (start === null || end === null || end <= start) return 1;
  return Math.max(1, (end - start) / 60);
}

function providerPriceEstimate(
  provider: ProviderSearchItem,
  hours: number
): number | null {
  if (provider.price === null) return null;
  return provider.pricingType === "hourly"
    ? provider.price * hours
    : provider.price;
}

function lowestEstimatedPrice(
  providers: ProviderSearchItem[],
  hours: number
): number | null {
  const values = providers
    .map((provider) => providerPriceEstimate(provider, hours))
    .filter(
      (value): value is number => value !== null && Number.isFinite(value)
    )
    .sort((first, second) => first - second);

  return values[0] ?? null;
}

export function buildSearchRecoverySuggestions(
  filters: SearchRecoveryFilters,
  result: ProviderSearchResponse,
  locale: KlyxLocale = "fr"
): SearchRecoverySuggestion[] {
  const suggestions: SearchRecoverySuggestion[] = [];
  const hours = durationHours(filters);
  const t = (key: Parameters<typeof translateKlyxSearchRecovery>[1]) =>
    translateKlyxSearchRecovery(locale, key);

  if (filters.budget) {
    const currentBudget = Number(filters.budget);
    const cheapest = lowestEstimatedPrice(result.providers, hours);

    if (
      Number.isFinite(currentBudget) &&
      cheapest !== null &&
      cheapest > currentBudget
    ) {
      const next = cloneFilters(filters);
      const raisedBudget = Math.ceil(cheapest);
      next.budget = String(raisedBudget);

      suggestions.push({
        id: "raise_budget",
        title: formatKlyxSearchRecoveryRaiseBudgetTitle(locale, raisedBudget),
        description: t("raiseBudgetDescription"),
        priority: 100,
        nextFilters: next,
      });
    }

    const next = cloneFilters(filters);
    next.budget = "";

    suggestions.push({
      id: "remove_budget",
      title: t("removeBudgetTitle"),
      description: t("removeBudgetDescription"),
      priority: 80,
      nextFilters: next,
    });
  }

  if (filters.startTime || filters.endTime) {
    const next = cloneFilters(filters);
    next.startTime = "";
    next.endTime = "";

    suggestions.push({
      id: "remove_time",
      title: t("removeTimeTitle"),
      description: t("removeTimeDescription"),
      priority: 95,
      nextFilters: next,
    });
  }

  if (filters.date) {
    const next = cloneFilters(filters);
    next.date = "";
    next.startTime = "";
    next.endTime = "";

    suggestions.push({
      id: "remove_date",
      title: t("removeDateTitle"),
      description: t("removeDateDescription"),
      priority: 65,
      nextFilters: next,
    });
  }

  if (filters.startTime && filters.endTime && hours > 1) {
    const start = timeToMinutes(filters.startTime);

    if (start !== null) {
      const next = cloneFilters(filters);
      const end = start + 60;

      if (end < 24 * 60) {
        next.endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(
          end % 60
        ).padStart(2, "0")}`;

        suggestions.push({
          id: "shorter_duration",
          title: t("shorterDurationTitle"),
          description: t("shorterDurationDescription"),
          priority: 75,
          nextFilters: next,
        });
      }
    }
  }

  if (filters.pricing !== "all") {
    const next = cloneFilters(filters);
    next.pricing = "all";

    suggestions.push({
      id: "remove_pricing",
      title: t("removePricingTitle"),
      description: t("removePricingDescription"),
      priority: 55,
      nextFilters: next,
    });
  }

  if (filters.city) {
    const next = cloneFilters(filters);
    next.city = "";

    suggestions.push({
      id: "remove_city",
      title: t("removeCityTitle"),
      description: t("removeCityDescription"),
      priority: 45,
      nextFilters: next,
    });
  }

  const showAll = cloneFilters(filters);
  showAll.city = "";
  showAll.date = "";
  showAll.startTime = "";
  showAll.endTime = "";
  showAll.budget = "";
  showAll.pricing = "all";

  suggestions.push({
    id: "show_all",
    title: t("showAllTitle"),
    description: t("showAllDescription"),
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
    .sort((first, second) => second.priority - first.priority)
    .slice(0, 5);
}

export function recoveryHref(filters: SearchRecoveryFilters): string {
  const params = new URLSearchParams();

  if (filters.service !== "all") params.set("service", filters.service);
  if (filters.city.trim()) params.set("city", filters.city.trim());
  if (filters.date) params.set("date", filters.date);
  if (filters.startTime) params.set("start", filters.startTime);
  if (filters.endTime) params.set("end", filters.endTime);
  if (filters.budget && Number(filters.budget) >= 0) {
    params.set("budget", filters.budget);
  }
  if (filters.pricing !== "all") params.set("pricing", filters.pricing);
  if (filters.sort && filters.sort !== "recommended") {
    params.set("sort", filters.sort);
  }

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}
