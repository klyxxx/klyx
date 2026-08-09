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
  if (!requestedCity.trim()) {
    return true;
  }

  const requested = normalize(requestedCity);

  return [
    provider.city,
    ...provider.serviceArea,
  ].some((location) => {
    const normalized = normalize(location);

    return Boolean(
      normalized &&
        (
          normalized.includes(requested) ||
          requested.includes(normalized)
        )
    );
  });
}

function timeToMinutes(
  value: string
): number | null {
  const match =
    /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    hours > 23 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function requestedDurationHours(
  startTime: string,
  endTime: string
): number {
  const start =
    timeToMinutes(startTime);

  const end =
    timeToMinutes(endTime);

  if (
    start === null ||
    end === null ||
    end <= start
  ) {
    return 1;
  }

  return Math.max(
    1,
    (end - start) / 60
  );
}

function budgetResult(
  provider: ProviderSearchItem,
  budgetValue: string,
  startTime: string,
  endTime: string
): {
  fits: boolean;
  estimated: number | null;
  budget: number | null;
} {
  const budget =
    budgetValue.trim()
      ? Number(budgetValue)
      : null;

  const duration =
    requestedDurationHours(
      startTime,
      endTime
    );

  if (provider.price == null) {
    return {
      fits: budget == null,
      estimated: null,
      budget,
    };
  }

  const estimated =
    provider.pricingType === "hourly"
      ? provider.price * duration
      : provider.price;

  return {
    fits:
      budget == null ||
      (
        Number.isFinite(budget) &&
        estimated <= budget
      ),
    estimated,
    budget:
      budget != null &&
      Number.isFinite(budget)
        ? budget
        : null,
  };
}

function compatibilityLevel(
  score: number
): MatchExplanation["level"] {
  if (score >= 90) {
    return "excellent";
  }

  if (score >= 75) {
    return "strong";
  }

  if (score >= 55) {
    return "possible";
  }

  return "alternative";
}

export function explainProviderMatch(
  provider: ProviderSearchItem,
  filters: MatchingFilters
): MatchExplanation {
  let score = 0;

  const reasons: string[] = [];
  const warnings: string[] = [];

  const locationOk =
    locationMatches(
      provider,
      filters.city
    );

  if (locationOk) {
    score += filters.city
      ? 20
      : 10;

    reasons.push(
      filters.city
        ? "Intervient dans la zone demandée"
        : "Zone de déplacement renseignée"
    );
  } else {
    warnings.push(
      "La zone demandée n’est pas confirmée"
    );
  }

  if (
    filters.date ||
    filters.startTime ||
    filters.endTime
  ) {
    if (provider.isExactMatch) {
      score += 25;

      reasons.push(
        "Disponible au créneau recherché"
      );
    } else {
      warnings.push(
        "Le créneau exact reste à confirmer"
      );
    }
  } else {
    score += 10;

    reasons.push(
      "Disponibilités professionnelles renseignées"
    );
  }

  const budget =
    budgetResult(
      provider,
      filters.budget,
      filters.startTime,
      filters.endTime
    );

  if (budget.fits) {
    score += filters.budget
      ? 20
      : 10;

    if (
      budget.estimated != null &&
      budget.budget != null
    ) {
      reasons.push(
        `Estimation compatible avec le budget (${budget.estimated.toFixed(
          2
        )} €)`
      );
    } else if (
      provider.price != null
    ) {
      reasons.push(
        "Tarif clairement renseigné"
      );
    }
  } else if (
    budget.estimated != null &&
    budget.budget != null
  ) {
    warnings.push(
      `Estimation supérieure au budget (${budget.estimated.toFixed(
        2
      )} €)`
    );
  } else {
    warnings.push(
      "Tarif encore à confirmer"
    );
  }

  const trustPoints =
    Math.round(
      Math.max(
        0,
        Math.min(
          100,
          provider.klyxScore
        )
      ) * 0.2
    );

  score += trustPoints;

  if (
    provider.klyxScore >= 80
  ) {
    reasons.push(
      "Très bon score de confiance"
    );
  } else if (
    provider.klyxScore >= 60
  ) {
    reasons.push(
      "Score de confiance correct"
    );
  } else {
    warnings.push(
      "Profil encore récent ou peu évalué"
    );
  }

  if (provider.isVerified) {
    score += 10;

    reasons.push(
      "Profil vérifié"
    );
  }

  if (
    provider.completedJobs >= 10
  ) {
    score += 8;

    reasons.push(
      `${provider.completedJobs} prestations réalisées`
    );
  } else if (
    provider.completedJobs > 0
  ) {
    score += 4;

    reasons.push(
      `${provider.completedJobs} prestation${
        provider.completedJobs > 1
          ? "s"
          : ""
      } réalisée${
        provider.completedJobs > 1
          ? "s"
          : ""
      }`
    );
  }

  if (
    provider.yearsExperience >= 5
  ) {
    score += 7;

    reasons.push(
      `${provider.yearsExperience} ans d’expérience`
    );
  } else if (
    provider.yearsExperience > 0
  ) {
    score += 3;
  }

  if (
    provider.cancellationRate <= 0.1
  ) {
    score += 5;

    reasons.push(
      "Faible taux d’annulation"
    );
  } else if (
    provider.cancellationRate >= 0.35
  ) {
    warnings.push(
      "Taux d’annulation plus élevé"
    );
  }

  if (
    filters.pricing !== "all" &&
    provider.pricingType ===
      filters.pricing
  ) {
    score += 5;

    reasons.push(
      "Type de tarif souhaité"
    );
  }

  const finalScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(score)
      )
    );

  return {
    score: finalScore,
    level:
      compatibilityLevel(
        finalScore
      ),
    reasons:
      reasons.slice(0, 5),
    warnings:
      warnings.slice(0, 3),
  };
}

export function matchingLevelLabel(
  level: MatchExplanation["level"]
): string {
  if (level === "excellent") {
    return "Excellente compatibilité";
  }

  if (level === "strong") {
    return "Très bonne compatibilité";
  }

  if (level === "possible") {
    return "Compatibilité possible";
  }

  return "Alternative à vérifier";
}