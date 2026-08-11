import { normalizeLocation, timeToMinutes } from "@/lib/provider-search";

export type MarketMatchInput = {
  requestCity: string;
  requestedDate: string | null;
  requestedTime: string | null;
  budgetMax: number | null;
  providerCity: string;
  serviceArea: string[];
  providerPrice: number | null;
  pricingType: "hourly" | "fixed";
  klyxScore: number;
  rating: number;
  reviewCount: number;
  yearsExperience: number;
  isVerified: boolean;
  availability: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

export type MarketMatchResult = {
  score: number;
  reasons: string[];
  locationMatch: boolean;
  availabilityMatch: boolean;
  budgetMatch: boolean | null;
};

function locationMatches(input: MarketMatchInput): boolean {
  const requested = normalizeLocation(input.requestCity);
  if (!requested) return true;

  return [input.providerCity, ...input.serviceArea].some((value) => {
    const normalized = normalizeLocation(value);
    return Boolean(
      normalized &&
        (normalized.includes(requested) || requested.includes(normalized))
    );
  });
}

function availabilityMatches(input: MarketMatchInput): boolean {
  if (!input.requestedDate && !input.requestedTime) return true;
  if (input.availability.length === 0) return false;

  const day = input.requestedDate
    ? new Date(`${input.requestedDate}T12:00:00Z`).getUTCDay()
    : null;
  const requestedMinutes = input.requestedTime
    ? timeToMinutes(input.requestedTime)
    : null;

  return input.availability.some((slot) => {
    if (day !== null && Number(slot.day_of_week) !== day) return false;
    if (requestedMinutes === null) return true;

    const start = timeToMinutes(slot.start_time);
    const end = timeToMinutes(slot.end_time);

    return (
      start !== null &&
      end !== null &&
      requestedMinutes >= start &&
      requestedMinutes < end
    );
  });
}

export function calculateMarketMatch(
  input: MarketMatchInput
): MarketMatchResult {
  const locationMatch = locationMatches(input);
  const availabilityMatch = availabilityMatches(input);

  const budgetMatch =
    input.budgetMax === null || input.providerPrice === null
      ? null
      : input.providerPrice <= input.budgetMax;

  let score = 25; // métier déjà garanti compatible par l'API
  const reasons: string[] = ["Métier compatible"];

  if (locationMatch) {
    score += 20;
    reasons.push("Zone compatible");
  }

  if (availabilityMatch) {
    score += 20;
    reasons.push("Disponible au créneau demandé");
  }

  if (budgetMatch === true) {
    score += 10;
    reasons.push("Tarif dans le budget");
  } else if (budgetMatch === null) {
    score += 5;
  }

  const reputation = Math.min(10, Math.max(0, input.klyxScore) / 10);
  score += reputation;

  if (input.rating >= 4 && input.reviewCount > 0) {
    score += Math.min(5, input.rating);
    reasons.push(`${input.rating.toFixed(1)}/5 (${input.reviewCount} avis)`);
  }

  if (input.yearsExperience >= 1) {
    score += Math.min(5, input.yearsExperience);
    reasons.push(
      `${input.yearsExperience} an${input.yearsExperience > 1 ? "s" : ""} d’expérience`
    );
  }

  if (input.isVerified) {
    score += 5;
    reasons.push("Profil vérifié");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.slice(0, 5),
    locationMatch,
    availabilityMatch,
    budgetMatch,
  };
}
