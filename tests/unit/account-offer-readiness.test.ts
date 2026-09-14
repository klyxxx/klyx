import { describe, expect, it } from "vitest";

import {
  detectOfferServicesIntent,
  mergeOfferLegalDraft,
  mergeOfferPricingDraft,
  parseOfferAvailability,
  parseOfferDayOfWeek,
  parseOfferRadiusKm,
} from "@/lib/account-offer-readiness";

describe("account offer readiness conversation parsing", () => {
  it("detects a natural work intent without requiring a provider role", () => {
    expect(
      detectOfferServicesIntent(
        "Je sais monter des meubles et je veux gagner de l’argent samedi."
      )
    ).toBe(true);
  });

  it("keeps the offer flow active for short follow-up answers", () => {
    expect(detectOfferServicesIntent("Bruxelles", true)).toBe(true);
  });

  it("accepts only an explicit valid intervention radius", () => {
    expect(parseOfferRadiusKm("Bruxelles, 20 km")).toBe(20);
    expect(parseOfferRadiusKm("Bruxelles")).toBeNull();
    expect(parseOfferRadiusKm("150 km")).toBeNull();
  });

  it("does not invent the pricing method and can complete it on the next turn", () => {
    const amountOnly = mergeOfferPricingDraft("35 €", null);
    expect(amountOnly).toEqual({ amount: 35, pricingType: null });
    expect(mergeOfferPricingDraft("horaire", amountOnly)).toEqual({
      amount: 35,
      pricingType: "hourly",
    });
  });

  it("retains a stated day without inventing working hours", () => {
    expect(parseOfferDayOfWeek("Je veux travailler samedi")).toBe(6);
    expect(parseOfferAvailability("samedi", 6)).toBeNull();
  });

  it("uses a previously known day only when the user supplies an explicit time range", () => {
    expect(parseOfferAvailability("de 9h à 18h", 6)).toEqual({
      dayOfWeek: 6,
      startTime: "09:00",
      endTime: "18:00",
    });
  });

  it("records only explicit legal intent and frequency facts", () => {
    expect(mergeOfferLegalDraft("Je suis indépendant", null)).toEqual({
      pathwayIntent: "independent",
      activityFrequency: null,
      explicitUncertainty: false,
    });

    expect(
      mergeOfferLegalDraft("Je veux faire ça régulièrement", {
        pathwayIntent: "independent",
        activityFrequency: null,
        explicitUncertainty: false,
      })
    ).toEqual({
      pathwayIntent: "independent",
      activityFrequency: "recurring",
      explicitUncertainty: false,
    });
  });

  it("routes explicit legal uncertainty to review instead of guessing", () => {
    expect(mergeOfferLegalDraft("Je ne sais pas quel statut s'applique", null)).toEqual({
      pathwayIntent: "unknown",
      activityFrequency: "unknown",
      explicitUncertainty: true,
    });
    expect(mergeOfferLegalDraft("Bruxelles", null)).toBeNull();
  });
});
