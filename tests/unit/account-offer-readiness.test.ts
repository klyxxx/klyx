import { describe, expect, it } from "vitest";

import {
  detectOfferServicesIntent,
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
});
