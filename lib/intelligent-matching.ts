import type { KlyxLocale } from "./klyx-i18n";
import {
  formatKlyxMatchExplanation,
  translateKlyxMatchExplanation,
} from "./klyx-match-explanation-i18n";
import type { ProviderSearchItem } from "@/lib/provider-search";

export type MatchingFilters = {
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  budget: string;
  pricing: string;
};

export type MatchExplanation = {
  score: number;
  level: "excellent" | "strong" | "possible" | "alternative";
  reasons: string[];
  warnings: string[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function locationMatches(
  provider: ProviderSearchItem,
  requestedCity: string
): boolean {
  if (!requestedCity.trim()) return true;
  const requested = normalize(requestedCity);

  return [provider.city, ...provider.serviceArea].some((location) => {
    const normalized = normalize(location);
    return Boolean(
      normalized &&
        (normalized.includes(requested) || requested.includes(normalized))
    );
  });
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function requestedDurationHours(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 1;
  return Math.max(1, (end - start) / 60);
}

function budgetResult(
  provider: ProviderSearchItem,
  budgetValue: string,
  startTime: string,
  endTime: string
): { fits: boolean; estimated: number | null; budget: number | null } {
  const budget = budgetValue.trim() ? Number(budgetValue) : null;
  const duration = requestedDurationHours(startTime, endTime);

  if (provider.price == null) {
    return { fits: budget == null, estimated: null, budget };
  }

  const estimated =
    provider.pricingType === "hourly"
      ? provider.price * duration
      : provider.price;

  return {
    fits:
      budget == null || (Number.isFinite(budget) && estimated <= budget),
    estimated,
    budget: budget != null && Number.isFinite(budget) ? budget : null,
  };
}

function compatibilityLevel(score: number): MatchExplanation["level"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 55) return "possible";
  return "alternative";
}

export function explainProviderMatch(
  provider: ProviderSearchItem,
  filters: MatchingFilters,
  locale: KlyxLocale = "fr"
): MatchExplanation {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const t = (key: Parameters<typeof translateKlyxMatchExplanation>[1]) =>
    translateKlyxMatchExplanation(locale, key);
  const f = (
    key: Parameters<typeof formatKlyxMatchExplanation>[1],
    values: Record<string, string | number>
  ) => formatKlyxMatchExplanation(locale, key, values);

  const locationOk = locationMatches(provider, filters.city);
  if (locationOk) {
    score += filters.city ? 20 : 10;
    reasons.push(filters.city ? t("zoneRequested") : t("zoneKnown"));
  } else {
    warnings.push(t("zoneUnconfirmed"));
  }

  if (filters.date || filters.startTime || filters.endTime) {
    if (provider.isExactMatch) {
      score += 25;
      reasons.push(t("slotAvailable"));
    } else {
      warnings.push(t("slotConfirm"));
    }
  } else {
    score += 10;
    reasons.push(t("availabilityKnown"));
  }

  const budget = budgetResult(
    provider,
    filters.budget,
    filters.startTime,
    filters.endTime
  );

  if (budget.fits) {
    score += filters.budget ? 20 : 10;

    if (budget.estimated != null && budget.budget != null) {
      reasons.push(
        f("budgetCompatible", { amount: budget.estimated.toFixed(2) })
      );
    } else if (provider.price != null) {
      reasons.push(t("priceKnown"));
    }
  } else if (budget.estimated != null && budget.budget != null) {
    warnings.push(f("budgetExceeded", { amount: budget.estimated.toFixed(2) }));
  } else {
    warnings.push(t("priceConfirm"));
  }

  const trustPoints = Math.round(
    Math.max(0, Math.min(100, provider.klyxScore)) * 0.2
  );
  score += trustPoints;

  if (provider.klyxScore >= 80) {
    reasons.push(t("trustVeryGood"));
  } else if (provider.klyxScore >= 60) {
    reasons.push(t("trustGood"));
  } else {
    warnings.push(t("profileRecent"));
  }

  if (provider.isVerified) {
    score += 10;
    reasons.push(t("profileVerified"));
  }

  if (provider.completedJobs >= 10) {
    score += 8;
    reasons.push(f("completedJobsPlural", { count: provider.completedJobs }));
  } else if (provider.completedJobs > 0) {
    score += 4;
    reasons.push(
      f(
        provider.completedJobs > 1
          ? "completedJobsPlural"
          : "completedJobSingle",
        { count: provider.completedJobs }
      )
    );
  }

  if (provider.yearsExperience >= 5) {
    score += 7;
    reasons.push(f("yearsExperience", { count: provider.yearsExperience }));
  } else if (provider.yearsExperience > 0) {
    score += 3;
  }

  if (provider.cancellationRate <= 0.1) {
    score += 5;
    reasons.push(t("lowCancellation"));
  } else if (provider.cancellationRate >= 0.35) {
    warnings.push(t("highCancellation"));
  }

  if (filters.pricing !== "all" && provider.pricingType === filters.pricing) {
    score += 5;
    reasons.push(t("pricingTypeMatched"));
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    level: compatibilityLevel(finalScore),
    reasons: reasons.slice(0, 5),
    warnings: warnings.slice(0, 3),
  };
}

export function matchingLevelLabel(
  level: MatchExplanation["level"],
  locale: KlyxLocale = "fr"
): string {
  if (level === "excellent") {
    return translateKlyxMatchExplanation(locale, "levelExcellent");
  }
  if (level === "strong") {
    return translateKlyxMatchExplanation(locale, "levelStrong");
  }
  if (level === "possible") {
    return translateKlyxMatchExplanation(locale, "levelPossible");
  }
  return translateKlyxMatchExplanation(locale, "levelAlternative");
}
