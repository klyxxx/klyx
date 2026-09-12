import { describe, expect, it } from "vitest";

import {
  estimateServiceTotal,
  orchestrateIncomeGoal,
  orchestrateServiceRequest,
  serviceBudgetMatch,
  type KlyxIncomeMissionCandidate,
  type KlyxServiceCandidate,
} from "@/lib/klyx-orchestration";

function serviceCandidate(
  overrides: Partial<KlyxServiceCandidate> = {}
): KlyxServiceCandidate {
  return {
    id: "service-1",
    profileId: "provider-1",
    serviceSlug: "cleaning",
    providerLabel: "Prestataire 1",
    pricingType: "hourly",
    price: 30,
    klyxScore: 85,
    rating: 4.8,
    reviewCount: 20,
    completedJobs: 30,
    cancellationRate: 0.05,
    yearsExperience: 4,
    isVerified: true,
    skillMatch: true,
    zoneMatch: true,
    availabilityMatch: true,
    pricingMatch: true,
    budgetMatch: true,
    estimatedPrice: 60,
    ...overrides,
  };
}

function incomeCandidate(
  overrides: Partial<KlyxIncomeMissionCandidate> = {}
): KlyxIncomeMissionCandidate {
  return {
    id: "job-1",
    title: "Ménage",
    serviceSlug: "cleaning",
    serviceLabel: "Ménage",
    city: "Bruxelles",
    currency: "EUR",
    providerPricingType: "hourly",
    providerRate: 25,
    durationMinutes: 120,
    clientBudgetMax: 80,
    distanceKm: 4,
    trustScore: 80,
    skillMatch: true,
    zoneMatch: true,
    availabilityMatch: true,
    conflictsWithConfirmedMission: false,
    intervals: [
      {
        date: "2026-09-19",
        startTime: "09:00",
        endTime: "11:00",
      },
    ],
    scheduleComplete: true,
    ...overrides,
  };
}

describe("KLYX orchestration engine", () => {
  it("uses duration when evaluating an hourly service budget", () => {
    expect(estimateServiceTotal(30, "hourly", 3)).toBe(90);
    expect(serviceBudgetMatch(30, "hourly", 3, 80)).toBe(false);
    expect(serviceBudgetMatch(30, "hourly", 2, 80)).toBe(true);
  });

  it("returns at most three service solutions and marks exactly one primary recommendation", () => {
    const candidates = Array.from({ length: 5 }, (_, index) =>
      serviceCandidate({
        id: `service-${index + 1}`,
        profileId: `provider-${index + 1}`,
        providerLabel: `Prestataire ${index + 1}`,
        klyxScore: 90 - index,
      })
    );

    const result = orchestrateServiceRequest(
      {
        serviceSlug: "cleaning",
        city: "Bruxelles",
        date: "2026-09-19",
        startTime: "09:00",
        endTime: "11:00",
        durationHours: 2,
        budgetMax: 100,
        pricingType: "all",
      },
      candidates,
      3
    );

    expect(result.solutions).toHaveLength(3);
    expect(result.solutions.filter((solution) => solution.recommended)).toHaveLength(1);
    expect(result.primarySolutionId).toBe(result.solutions[0].id);
    expect(result.requiresUserConfirmation).toBe(true);
    expect(result.automaticBooking).toBe(false);
    expect(result.automaticPayment).toBe(false);
  });

  it("filters service candidates that violate zone, availability, budget or explicit trust constraints", () => {
    const result = orchestrateServiceRequest(
      {
        serviceSlug: "cleaning",
        city: "Bruxelles",
        date: "2026-09-19",
        startTime: "09:00",
        endTime: "11:00",
        durationHours: 2,
        budgetMax: 80,
        pricingType: "all",
        constraints: {
          requireVerified: true,
          minimumTrustScore: 70,
          maximumCancellationRate: 0.2,
        },
      },
      [
        serviceCandidate({ id: "ok", profileId: "ok" }),
        serviceCandidate({ id: "zone", profileId: "zone", zoneMatch: false }),
        serviceCandidate({ id: "time", profileId: "time", availabilityMatch: false }),
        serviceCandidate({ id: "budget", profileId: "budget", budgetMatch: false }),
        serviceCandidate({ id: "trust", profileId: "trust", klyxScore: 60 }),
        serviceCandidate({ id: "verify", profileId: "verify", isVerified: false }),
        serviceCandidate({ id: "cancel", profileId: "cancel", cancellationRate: 0.4 }),
      ]
    );

    expect(result.solutions.map((solution) => solution.providerId)).toEqual(["ok"]);
  });

  it("never uses the client budget ceiling as provider income when the configured amount is unknown", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 100,
        currency: "EUR",
        dayOfWeek: 6,
        date: null,
        startTime: null,
        endTime: null,
      },
      [
        incomeCandidate({
          providerRate: null,
          durationMinutes: null,
          clientBudgetMax: 150,
        }),
      ]
    );

    expect(result.solutions).toEqual([]);
    expect(result.eligibleCandidates).toBe(0);
  });

  it("calculates provider income only from the configured rate and known duration", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 50,
        currency: "EUR",
        dayOfWeek: 6,
        date: null,
        startTime: null,
        endTime: null,
      },
      [incomeCandidate()]
    );

    expect(result.solutions[0].configuredAmount).toBe(50);
    expect(result.solutions[0].missions[0].configuredAmount).toBe(50);
    expect(result.solutions[0].missions[0].reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PROVIDER_RATE" }),
      ])
    );
  });

  it("excludes missions that conflict with confirmed work", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 50,
        currency: "EUR",
        dayOfWeek: 6,
        date: null,
        startTime: null,
        endTime: null,
      },
      [incomeCandidate({ conflictsWithConfirmedMission: true })]
    );

    expect(result.solutions).toEqual([]);
  });

  it("can build compatible non-overlapping mission combinations without automatic action", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 100,
        currency: "EUR",
        dayOfWeek: 6,
        date: null,
        startTime: "08:00",
        endTime: "16:00",
      },
      [
        incomeCandidate({
          id: "job-a",
          durationMinutes: 120,
          intervals: [
            { date: "2026-09-19", startTime: "09:00", endTime: "11:00" },
          ],
        }),
        incomeCandidate({
          id: "job-b",
          title: "Deuxième ménage",
          durationMinutes: 120,
          intervals: [
            { date: "2026-09-19", startTime: "12:00", endTime: "14:00" },
          ],
        }),
      ]
    );

    expect(result.solutions[0].missions.map((mission) => mission.id).sort()).toEqual([
      "job-a",
      "job-b",
    ]);
    expect(result.solutions[0].configuredAmount).toBe(100);
    expect(result.solutions.length).toBeLessThanOrEqual(3);
    expect(result.automaticAcceptance).toBe(false);
    expect(result.automaticOffer).toBe(false);
    expect(result.automaticBooking).toBe(false);
    expect(result.automaticPayment).toBe(false);
    expect(result.refusalPenalty).toBe(false);
    expect(result.providerPriceChanged).toBe(false);
    expect(result.requiresUserConfirmation).toBe(true);
  });

  it("does not combine overlapping missions", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 100,
        currency: "EUR",
        dayOfWeek: 6,
        date: null,
        startTime: null,
        endTime: null,
      },
      [
        incomeCandidate({
          id: "job-a",
          intervals: [
            { date: "2026-09-19", startTime: "09:00", endTime: "11:00" },
          ],
        }),
        incomeCandidate({
          id: "job-b",
          intervals: [
            { date: "2026-09-19", startTime: "10:00", endTime: "12:00" },
          ],
        }),
      ]
    );

    expect(result.solutions.every((solution) => solution.missions.length === 1)).toBe(true);
  });
});
