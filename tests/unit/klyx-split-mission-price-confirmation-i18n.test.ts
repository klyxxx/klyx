import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionPriceConfirmationDictionary,
  KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionPriceConfirmationLocale,
} from "@/lib/klyx-split-mission-price-confirmation-i18n";

describe("KLYX split mission price confirmation i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSplitMissionPriceConfirmationDictionary(locale);
      for (const key of KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_MESSAGE_KEYS) {
        if (key === "overBudgetCountPrefix") continue;
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps price confirmation explicitly non-paying in every locale", () => {
    expect(getKlyxSplitMissionPriceConfirmationDictionary("fr").noPaymentSafety).toContain(
      "ne paie rien"
    );
    expect(getKlyxSplitMissionPriceConfirmationDictionary("en").noPaymentSafety).toContain(
      "pays nothing"
    );
    expect(getKlyxSplitMissionPriceConfirmationDictionary("nl").noPaymentSafety).toContain(
      "betaalt niets"
    );
    expect(getKlyxSplitMissionPriceConfirmationDictionary("de").noPaymentSafety).toContain(
      "keine Zahlung"
    );
  });

  it("keeps over-budget consent explicit in every locale", () => {
    expect(getKlyxSplitMissionPriceConfirmationDictionary("fr").overBudgetConsent).toContain(
      "explicitement"
    );
    expect(getKlyxSplitMissionPriceConfirmationDictionary("en").overBudgetConsent).toContain(
      "explicitly"
    );
    expect(getKlyxSplitMissionPriceConfirmationDictionary("nl").overBudgetConsent).toContain(
      "uitdrukkelijk"
    );
    expect(getKlyxSplitMissionPriceConfirmationDictionary("de").overBudgetConsent).toContain(
      "ausdrücklich"
    );
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionPriceConfirmationLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionPriceConfirmationDictionary("es")).toEqual(
      getKlyxSplitMissionPriceConfirmationDictionary("fr")
    );
  });
});
