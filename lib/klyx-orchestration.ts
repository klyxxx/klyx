export type KlyxPricingType = "hourly" | "fixed";

export type KlyxOrchestrationEvidence = {
  code: string;
  label: string;
  source: "klyx_live" | "provider_config" | "derived";
};

export type KlyxServiceRequest = {
  serviceSlug: string;
  city: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: number;
  budgetMax: number | null;
  pricingType: "all" | KlyxPricingType;
  constraints?: {
    requireVerified?: boolean;
    minimumTrustScore?: number | null;
    maximumCancellationRate?: number | null;
  };
};

export type KlyxServiceCandidate = {
  id: string;
  profileId: string;
  serviceSlug: string;
  providerLabel: string;
  pricingType: KlyxPricingType;
  price: number | null;
  klyxScore: number;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  cancellationRate: number;
  yearsExperience: number;
  isVerified: boolean;
  skillMatch: boolean;
  zoneMatch: boolean;
  availabilityMatch: boolean;
  pricingMatch: boolean;
  budgetMatch: boolean | null;
  estimatedPrice: number | null;
};

export type KlyxServiceSolution = {
  id: string;
  rank: number;
  recommended: boolean;
  score: number;
  providerId: string;
  providerLabel: string;
  estimatedPrice: number | null;
  reasons: KlyxOrchestrationEvidence[];
  warnings: KlyxOrchestrationEvidence[];
  requiresConfirmation: true;
};

export type KlyxServiceOrchestrationResult = {
  kind: "service_request";
  dataSource: "klyx_live";
  primarySolutionId: string | null;
  solutions: KlyxServiceSolution[];
  evaluatedCandidates: number;
  eligibleCandidates: number;
  automaticBooking: false;
  automaticPayment: false;
  requiresUserConfirmation: true;
};

export type KlyxIncomeInterval = {
  date: string;
  startTime: string;
  endTime: string;
};

export type KlyxIncomeGoal = {
  targetAmount: number;
  currency: string;
  dayOfWeek: number | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  maximumDistanceKm?: number | null;
};

export type KlyxIncomeMissionCandidate = {
  id: string;
  title: string;
  serviceSlug: string;
  serviceLabel: string;
  city: string;
  currency: string;
  providerPricingType: KlyxPricingType;
  providerRate: number | null;
  durationMinutes: number | null;
  clientBudgetMax: number | null;
  distanceKm: number | null;
  trustScore: number | null;
  skillMatch: boolean;
  zoneMatch: boolean;
  availabilityMatch: boolean;
  conflictsWithConfirmedMission: boolean;
  intervals: KlyxIncomeInterval[];
  scheduleComplete: boolean;
};

export type KlyxIncomeMissionSolution = {
  id: string;
  title: string;
  city: string;
  serviceLabel: string;
  configuredAmount: number;
  distanceKm: number | null;
  reasons: KlyxOrchestrationEvidence[];
};

export type KlyxIncomeSolution = {
  id: string;
  rank: number;
  recommended: boolean;
  configuredAmount: number;
  differenceToTarget: number;
  score: number;
  missions: KlyxIncomeMissionSolution[];
  explanation: string;
  warnings: KlyxOrchestrationEvidence[];
  requiresConfirmation: true;
};

export type KlyxIncomeOrchestrationResult = {
  kind: "income_goal";
  dataSource: "klyx_live";
  primarySolutionId: string | null;
  solutions: KlyxIncomeSolution[];
  evaluatedCandidates: number;
  eligibleCandidates: number;
  automaticAcceptance: false;
  automaticOffer: false;
  automaticBooking: false;
  automaticPayment: false;
  refusalPenalty: false;
  providerPriceChanged: false;
  requiresUserConfirmation: true;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateServiceTotal(
  price: number | null,
  pricingType: KlyxPricingType,
  durationHours: number
): number | null {
  if (price === null || !Number.isFinite(price) || price < 0) return null;
  if (pricingType === "fixed") return round2(price);
  if (!Number.isFinite(durationHours) || durationHours <= 0) return null;
  return round2(price * durationHours);
}

export function serviceBudgetMatch(
  price: number | null,
  pricingType: KlyxPricingType,
  durationHours: number,
  budgetMax: number | null
): boolean | null {
  if (budgetMax === null) return true;
  const estimated = estimateServiceTotal(price, pricingType, durationHours);
  return estimated === null ? null : estimated <= budgetMax;
}

function serviceConstraintMatches(
  request: KlyxServiceRequest,
  candidate: KlyxServiceCandidate
): boolean {
  const constraints = request.constraints;
  if (!constraints) return true;

  if (constraints.requireVerified === true && !candidate.isVerified) return false;

  if (
    typeof constraints.minimumTrustScore === "number" &&
    candidate.klyxScore < constraints.minimumTrustScore
  ) {
    return false;
  }

  if (
    typeof constraints.maximumCancellationRate === "number" &&
    candidate.cancellationRate > constraints.maximumCancellationRate
  ) {
    return false;
  }

  return true;
}

function scoreServiceCandidate(candidate: KlyxServiceCandidate): number {
  let score = 0;
  score += candidate.skillMatch ? 20 : 0;
  score += candidate.zoneMatch ? 20 : 0;
  score += candidate.availabilityMatch ? 20 : 0;
  score += candidate.budgetMatch === true ? 15 : candidate.budgetMatch === null ? 5 : 0;
  score += candidate.pricingMatch ? 5 : 0;
  score += clamp(candidate.klyxScore, 0, 100) * 0.12;
  score += candidate.isVerified ? 4 : 0;
  score += candidate.reviewCount > 0 ? clamp(candidate.rating, 0, 5) * 0.6 : 0;
  score += candidate.completedJobs >= 10 ? 2 : candidate.completedJobs > 0 ? 1 : 0;
  score += candidate.cancellationRate <= 0.1 ? 2 : 0;
  return Math.round(clamp(score, 0, 100));
}

function serviceEvidence(candidate: KlyxServiceCandidate): {
  reasons: KlyxOrchestrationEvidence[];
  warnings: KlyxOrchestrationEvidence[];
} {
  const reasons: KlyxOrchestrationEvidence[] = [
    { code: "SKILL_MATCH", label: "Compétence active compatible", source: "klyx_live" },
    { code: "ZONE_MATCH", label: "Zone d’intervention compatible", source: "klyx_live" },
    { code: "AVAILABILITY_MATCH", label: "Créneau compatible avec la disponibilité enregistrée", source: "klyx_live" },
  ];
  const warnings: KlyxOrchestrationEvidence[] = [];

  if (candidate.budgetMatch === true && candidate.estimatedPrice !== null) {
    reasons.push({
      code: "BUDGET_MATCH",
      label: `Coût estimé ${candidate.estimatedPrice.toFixed(2)} € dans le budget`,
      source: "derived",
    });
  } else if (candidate.budgetMatch === null) {
    warnings.push({
      code: "PRICE_UNKNOWN",
      label: "Prix total non vérifiable avec les données actuelles",
      source: "klyx_live",
    });
  }

  if (candidate.klyxScore >= 80) {
    reasons.push({
      code: "HIGH_TRUST",
      label: `Confiance KLYX ${Math.round(candidate.klyxScore)}/100`,
      source: "klyx_live",
    });
  }

  if (candidate.isVerified) {
    reasons.push({
      code: "VERIFIED_PROVIDER",
      label: "Profil vérifié",
      source: "klyx_live",
    });
  }

  return { reasons: reasons.slice(0, 5), warnings: warnings.slice(0, 3) };
}

export function orchestrateServiceRequest(
  request: KlyxServiceRequest,
  candidates: readonly KlyxServiceCandidate[],
  limit = 3
): KlyxServiceOrchestrationResult {
  const eligible = candidates
    .filter((candidate) =>
      candidate.skillMatch &&
      candidate.zoneMatch &&
      candidate.availabilityMatch &&
      candidate.pricingMatch &&
      candidate.budgetMatch !== false &&
      serviceConstraintMatches(request, candidate)
    )
    .map((candidate) => ({
      candidate,
      score: scoreServiceCandidate(candidate),
    }))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.candidate.klyxScore !== right.candidate.klyxScore) {
        return right.candidate.klyxScore - left.candidate.klyxScore;
      }
      const leftPrice = left.candidate.estimatedPrice ?? Number.POSITIVE_INFINITY;
      const rightPrice = right.candidate.estimatedPrice ?? Number.POSITIVE_INFINITY;
      return leftPrice - rightPrice;
    })
    .slice(0, clamp(limit, 1, 3));

  const solutions = eligible.map(({ candidate, score }, index): KlyxServiceSolution => {
    const evidence = serviceEvidence(candidate);
    return {
      id: `service:${candidate.id}`,
      rank: index + 1,
      recommended: index === 0,
      score,
      providerId: candidate.profileId,
      providerLabel: candidate.providerLabel,
      estimatedPrice: candidate.estimatedPrice,
      reasons: evidence.reasons,
      warnings: evidence.warnings,
      requiresConfirmation: true,
    };
  });

  return {
    kind: "service_request",
    dataSource: "klyx_live",
    primarySolutionId: solutions[0]?.id ?? null,
    solutions,
    evaluatedCandidates: candidates.length,
    eligibleCandidates: eligible.length,
    automaticBooking: false,
    automaticPayment: false,
    requiresUserConfirmation: true,
  };
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.slice(0, 5));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function intervalOverlap(left: KlyxIncomeInterval, right: KlyxIncomeInterval): boolean {
  if (left.date !== right.date) return false;
  const leftStart = timeToMinutes(left.startTime);
  const leftEnd = timeToMinutes(left.endTime);
  const rightStart = timeToMinutes(right.startTime);
  const rightEnd = timeToMinutes(right.endTime);
  if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) {
    return true;
  }
  return leftStart < rightEnd && rightStart < leftEnd;
}

function configuredMissionAmount(candidate: KlyxIncomeMissionCandidate): number | null {
  if (candidate.providerRate === null || candidate.providerRate < 0) return null;
  if (candidate.providerPricingType === "fixed") return round2(candidate.providerRate);
  if (candidate.durationMinutes === null || candidate.durationMinutes <= 0) return null;
  return round2(candidate.providerRate * (candidate.durationMinutes / 60));
}

function goalContainsCandidate(goal: KlyxIncomeGoal, candidate: KlyxIncomeMissionCandidate): boolean {
  if (candidate.currency.toUpperCase() !== goal.currency.toUpperCase()) return false;
  if (!candidate.skillMatch || !candidate.zoneMatch || !candidate.availabilityMatch) return false;
  if (candidate.conflictsWithConfirmedMission) return false;
  if (goal.maximumDistanceKm != null && candidate.distanceKm != null) {
    if (candidate.distanceKm > goal.maximumDistanceKm) return false;
  }
  const configured = configuredMissionAmount(candidate);
  if (configured === null) return false;
  if (candidate.clientBudgetMax !== null && configured > candidate.clientBudgetMax) return false;
  return true;
}

function candidateWindowMatches(goal: KlyxIncomeGoal, candidate: KlyxIncomeMissionCandidate): boolean {
  if (goal.date && !candidate.intervals.every((interval) => interval.date === goal.date)) {
    return false;
  }
  if (goal.dayOfWeek !== null) {
    const matchesDay = candidate.intervals.every((interval) => {
      const parsed = new Date(`${interval.date}T12:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.getUTCDay() === goal.dayOfWeek;
    });
    if (!matchesDay) return false;
  }
  if (goal.startTime && goal.endTime) {
    const goalStart = timeToMinutes(goal.startTime);
    const goalEnd = timeToMinutes(goal.endTime);
    if (goalStart === null || goalEnd === null) return false;
    for (const interval of candidate.intervals) {
      const start = timeToMinutes(interval.startTime);
      const end = timeToMinutes(interval.endTime);
      if (start === null || end === null || start < goalStart || end > goalEnd) return false;
    }
  }
  return true;
}

function canCombineIncomeMissions(missions: readonly KlyxIncomeMissionCandidate[]): boolean {
  if (missions.length <= 1) return true;
  if (missions.some((mission) => !mission.scheduleComplete)) return false;

  for (let first = 0; first < missions.length; first += 1) {
    for (let second = first + 1; second < missions.length; second += 1) {
      for (const left of missions[first].intervals) {
        for (const right of missions[second].intervals) {
          if (intervalOverlap(left, right)) return false;
        }
      }

      const differentCities = missions[first].city.trim().toLowerCase() !== missions[second].city.trim().toLowerCase();
      if (differentCities) {
        const firstDistance = missions[first].distanceKm;
        const secondDistance = missions[second].distanceKm;
        if (firstDistance === null || secondDistance === null) return false;
      }
    }
  }

  return true;
}

function incomeMissionEvidence(candidate: KlyxIncomeMissionCandidate, amount: number): KlyxOrchestrationEvidence[] {
  const evidence: KlyxOrchestrationEvidence[] = [
    { code: "SKILL_MATCH", label: "Compétence active compatible", source: "klyx_live" },
    { code: "ZONE_MATCH", label: "Mission dans la zone configurée", source: "klyx_live" },
    { code: "AVAILABILITY_MATCH", label: "Créneau compatible avec les disponibilités", source: "klyx_live" },
    { code: "PROVIDER_RATE", label: `${amount.toFixed(2)} € calculés depuis le tarif configuré`, source: "provider_config" },
  ];

  if (candidate.distanceKm !== null) {
    evidence.push({
      code: "DISTANCE_KNOWN",
      label: `Distance géographique estimée ${candidate.distanceKm.toFixed(1)} km`,
      source: "derived",
    });
  }

  return evidence.slice(0, 5);
}

function incomeCombinationScore(total: number, target: number, missions: readonly KlyxIncomeMissionCandidate[]): number {
  const gapRatio = target > 0 ? Math.abs(total - target) / target : 1;
  let score = 100 - clamp(gapRatio * 80, 0, 80);
  const knownDistances = missions.map((mission) => mission.distanceKm).filter((value): value is number => value !== null);
  if (knownDistances.length > 0) {
    const averageDistance = knownDistances.reduce((sum, value) => sum + value, 0) / knownDistances.length;
    score -= clamp(averageDistance / 5, 0, 12);
  }
  if (missions.length > 1) score -= (missions.length - 1) * 2;
  return Math.round(clamp(score, 0, 100));
}

export function orchestrateIncomeGoal(
  goal: KlyxIncomeGoal,
  candidates: readonly KlyxIncomeMissionCandidate[],
  limit = 3
): KlyxIncomeOrchestrationResult {
  const eligible = candidates
    .filter((candidate) => goalContainsCandidate(goal, candidate) && candidateWindowMatches(goal, candidate))
    .slice(0, 12);

  const sets: KlyxIncomeMissionCandidate[][] = [];
  for (let first = 0; first < eligible.length; first += 1) {
    sets.push([eligible[first]]);
    for (let second = first + 1; second < eligible.length; second += 1) {
      const pair = [eligible[first], eligible[second]];
      if (canCombineIncomeMissions(pair)) sets.push(pair);
      for (let third = second + 1; third < eligible.length; third += 1) {
        const trio = [eligible[first], eligible[second], eligible[third]];
        if (canCombineIncomeMissions(trio)) sets.push(trio);
      }
    }
  }

  const ranked = sets
    .map((missions) => {
      const amounts = missions.map(configuredMissionAmount);
      if (amounts.some((amount) => amount === null)) return null;
      const configuredAmount = round2((amounts as number[]).reduce((sum, amount) => sum + amount, 0));
      const differenceToTarget = round2(configuredAmount - goal.targetAmount);
      return {
        missions,
        configuredAmount,
        differenceToTarget,
        score: incomeCombinationScore(configuredAmount, goal.targetAmount, missions),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      const leftGap = Math.abs(left.differenceToTarget);
      const rightGap = Math.abs(right.differenceToTarget);
      if (leftGap !== rightGap) return leftGap - rightGap;
      if (left.score !== right.score) return right.score - left.score;
      if (left.missions.length !== right.missions.length) return left.missions.length - right.missions.length;
      return right.configuredAmount - left.configuredAmount;
    })
    .slice(0, clamp(limit, 1, 3));

  const solutions = ranked.map((item, index): KlyxIncomeSolution => {
    const warnings: KlyxOrchestrationEvidence[] = [];
    if (item.missions.some((mission) => mission.distanceKm === null)) {
      warnings.push({
        code: "DISTANCE_UNKNOWN",
        label: "Distance non calculable pour au moins une mission ; aucun temps de trajet fictif n’est utilisé",
        source: "klyx_live",
      });
    }
    return {
      id: `income:${item.missions.map((mission) => mission.id).join("+")}`,
      rank: index + 1,
      recommended: index === 0,
      configuredAmount: item.configuredAmount,
      differenceToTarget: item.differenceToTarget,
      score: item.score,
      missions: item.missions.map((mission) => {
        const amount = configuredMissionAmount(mission) as number;
        return {
          id: mission.id,
          title: mission.title,
          city: mission.city,
          serviceLabel: mission.serviceLabel,
          configuredAmount: amount,
          distanceKm: mission.distanceKm,
          reasons: incomeMissionEvidence(mission, amount),
        };
      }),
      explanation:
        Math.abs(item.differenceToTarget) <= Math.max(10, goal.targetAmount * 0.15)
          ? `Option la plus proche de l’objectif de ${goal.targetAmount.toFixed(2)} ${goal.currency}.`
          : item.differenceToTarget < 0
            ? `Sous l’objectif de ${goal.targetAmount.toFixed(2)} ${goal.currency}, mais parmi les combinaisons compatibles vérifiables les plus proches.`
            : `Au-dessus de l’objectif de ${goal.targetAmount.toFixed(2)} ${goal.currency}, avec des créneaux compatibles vérifiables.`,
      warnings,
      requiresConfirmation: true,
    };
  });

  return {
    kind: "income_goal",
    dataSource: "klyx_live",
    primarySolutionId: solutions[0]?.id ?? null,
    solutions,
    evaluatedCandidates: candidates.length,
    eligibleCandidates: eligible.length,
    automaticAcceptance: false,
    automaticOffer: false,
    automaticBooking: false,
    automaticPayment: false,
    refusalPenalty: false,
    providerPriceChanged: false,
    requiresUserConfirmation: true,
  };
}
