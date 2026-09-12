import { describe, expect, it } from "vitest";

import {
  orchestrateIncomeGoal,
  orchestrateServiceRequest,
  type KlyxIncomeMissionCandidate,
  type KlyxServiceCandidate,
} from "@/lib/klyx-orchestration";

const baseService: KlyxServiceCandidate = {
  id: "service",
  profileId: "provider",
  serviceSlug: "cleaning",
  providerLabel: "Provider",
  pricingType: "hourly",
  price: null,
  klyxScore: 80,
  rating: 4.5,
  reviewCount: 10,
  completedJobs: 10,
  cancellationRate: 0,
  yearsExperience: 2,
  isVerified: true,
  skillMatch: true,
  zoneMatch: true,
  availabilityMatch: true,
  pricingMatch: true,
  budgetMatch: null,
  estimatedPrice: null,
};

const baseIncome: KlyxIncomeMissionCandidate = {
  id: "job",
  title: "Mission",
  serviceSlug: "cleaning",
  serviceLabel: "Ménage",
  city: "Bruxelles",
  currency: "EUR",
  providerPricingType: "fixed",
  providerRate: 80,
  durationMinutes: 60,
  clientBudgetMax: 100,
  distanceKm: null,
  trustScore: 80,
  skillMatch: true,
  zoneMatch: true,
  availabilityMatch: true,
  conflictsWithConfirmedMission: false,
  intervals: [
    { date: "2026-09-19", startTime: "10:00", endTime: "11:00" },
  ],
  scheduleComplete: true,
};

describe("KLYX orchestration fail-closed facts", () => {
  it("does not claim budget compatibility when a requested budget cannot be verified", () => {
    const result = orchestrateServiceRequest(
      {
        serviceSlug: "cleaning",
        city: "Bruxelles",
        date: "2026-09-19",
        startTime: "10:00",
        endTime: "11:00",
        durationHours: 1,
        budgetMax: 50,
        pricingType: "all",
      },
      [baseService]
    );

    expect(result.solutions).toEqual([]);
  });

  it("can still surface an unpriced candidate when no budget constraint was requested", () => {
    const result = orchestrateServiceRequest(
      {
        serviceSlug: "cleaning",
        city: "Bruxelles",
        date: "2026-09-19",
        startTime: "10:00",
        endTime: "11:00",
        durationHours: 1,
        budgetMax: null,
        pricingType: "all",
      },
      [{ ...baseService, budgetMatch: true }]
    );

    expect(result.solutions).toHaveLength(1);
  });

  it("does not satisfy a maximum-distance constraint with an unknown distance", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 80,
        currency: "EUR",
        dayOfWeek: 6,
        date: "2026-09-19",
        startTime: null,
        endTime: null,
        maximumDistanceKm: 10,
      },
      [baseIncome]
    );

    expect(result.solutions).toEqual([]);
  });

  it("does not combine missions from distinct localities without real travel-time data", () => {
    const result = orchestrateIncomeGoal(
      {
        targetAmount: 160,
        currency: "EUR",
        dayOfWeek: 6,
        date: "2026-09-19",
        startTime: null,
        endTime: null,
      },
      [
        { ...baseIncome, id: "a", distanceKm: 2 },
        {
          ...baseIncome,
          id: "b",
          city: "Anderlecht",
          distanceKm: 3,
          intervals: [
            { date: "2026-09-19", startTime: "12:00", endTime: "13:00" },
          ],
        },
      ]
    );

    expect(result.solutions.every((solution) => solution.missions.length === 1)).toBe(true);
  });
});
