import { describe, expect, it } from "vitest";

import {
  type ProviderIncomeMissionCandidate,
  parseProviderIncomePlanRequest,
  rankProviderIncomeCombinations,
} from "@/lib/provider-income-plan";

function mission(
  id: string,
  amount: number,
  startTime: string,
  endTime: string | null,
  intervalsComplete = true
): ProviderIncomeMissionCandidate {
  return {
    requestId: id,
    title: `Mission ${id}`,
    serviceLabel: "Ménage",
    city: "Bruxelles",
    date: "2026-09-19",
    startTime,
    endTime,
    currency: "EUR",
    potentialAmount: amount,
    amountSource: "provider_rate",
    amountLabel: `${amount} EUR selon ton tarif configuré`,
    reasons: [
      "Métier actif compatible",
      "Dans ta zone configurée",
      "Créneau compatible avec tes disponibilités",
    ],
    intervals:
      intervalsComplete && endTime
        ? [
            {
              date: "2026-09-19",
              startTime,
              endTime,
            },
          ]
        : [],
    intervalsComplete,
  };
}

describe("KLYX provider income-plan intent", () => {
  it("parses the advertised French request with explicit EUR target", () => {
    const parsed = parseProviderIncomePlanRequest(
      "Je suis libre samedi, je veux gagner environ 100 €, trouve-moi des missions près de chez moi."
    );

    expect(parsed).toMatchObject({
      locale: "fr",
      targetAmount: 100,
      targetCurrency: "EUR",
      dayOfWeek: 6,
      dayLabel: "samedi",
    });
  });

  it("accepts a currency prefix and an optional bounded time window", () => {
    const parsed = parseProviderIncomePlanRequest(
      "I am free Saturday from 9 AM to 5 PM, want to earn about €120, find jobs near me."
    );

    expect(parsed).toMatchObject({
      locale: "en",
      targetAmount: 120,
      targetCurrency: "EUR",
      dayOfWeek: 6,
      startTime: "09:00",
      endTime: "17:00",
    });
  });

  it("does not hijack legacy availability or quote messages", () => {
    expect(
      parseProviderIncomePlanRequest("Je suis libre samedi de 9 h à 17 h.")
    ).toBeNull();
    expect(
      parseProviderIncomePlanRequest("Prépare un devis pour 3 heures.")
    ).toBeNull();
  });

  it("returns at most three combinations ordered near the revenue target", () => {
    const combinations = rankProviderIncomeCombinations(
      [
        mission("a", 40, "09:00", "10:00"),
        mission("b", 60, "10:30", "12:00"),
        mission("c", 80, "13:00", "15:00"),
        mission("d", 130, "16:00", "18:00"),
      ],
      100,
      "fr"
    );

    expect(combinations).toHaveLength(3);
    expect(combinations[0].potentialAmount).toBe(100);
    expect(combinations[0].missions.map((item) => item.requestId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("never combines missions whose exact intervals overlap", () => {
    const combinations = rankProviderIncomeCombinations(
      [
        mission("a", 50, "09:00", "11:00"),
        mission("b", 50, "10:00", "12:00"),
      ],
      100,
      "fr"
    );

    expect(
      combinations.some((combination) => combination.missions.length > 1)
    ).toBe(false);
  });

  it("keeps a mission with unknown end time standalone", () => {
    const combinations = rankProviderIncomeCombinations(
      [
        mission("single", 45, "09:00", null, false),
        mission("exact", 55, "12:00", "14:00"),
      ],
      100,
      "fr"
    );

    expect(
      combinations.some((combination) => combination.missions.length > 1)
    ).toBe(false);
    expect(
      combinations.some((combination) =>
        combination.missions.some((item) => item.requestId === "single")
      )
    ).toBe(true);
  });
});
