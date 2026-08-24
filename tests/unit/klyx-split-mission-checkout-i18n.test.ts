import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionCheckoutDictionary,
  KLYX_SPLIT_MISSION_CHECKOUT_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionCheckoutLocale,
} from "@/lib/klyx-split-mission-checkout-i18n";

describe("KLYX split mission checkout i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSplitMissionCheckoutDictionary(locale);
      for (const key of KLYX_SPLIT_MISSION_CHECKOUT_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps Checkout preparation non-charging in every locale", () => {
    expect(getKlyxSplitMissionCheckoutDictionary("fr").lastStepDescription).toContain(
      "ne débite rien"
    );
    expect(getKlyxSplitMissionCheckoutDictionary("en").lastStepDescription).toContain(
      "does not charge anything"
    );
    expect(getKlyxSplitMissionCheckoutDictionary("nl").lastStepDescription).toContain(
      "niets afgeschreven"
    );
    expect(getKlyxSplitMissionCheckoutDictionary("de").lastStepDescription).toContain(
      "nichts belastet"
    );
  });

  it("keeps the webhook as the paid-state authority in every locale", () => {
    for (const locale of KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES) {
      expect(getKlyxSplitMissionCheckoutDictionary(locale).missionPaidDescription).toMatch(
        /webhook/i
      );
    }
  });

  it("keeps explicit Checkout opening and silent-repayment prevention", () => {
    expect(getKlyxSplitMissionCheckoutDictionary("fr").safetySummary).toContain(
      "ouvrir explicitement chaque Checkout"
    );
    expect(getKlyxSplitMissionCheckoutDictionary("en").safetySummary).toContain(
      "explicitly open each unpaid Checkout"
    );
    expect(getKlyxSplitMissionCheckoutDictionary("nl").safetySummary).toContain(
      "uitdrukkelijk openen"
    );
    expect(getKlyxSplitMissionCheckoutDictionary("de").safetySummary).toContain(
      "ausdrücklich öffnen"
    );

    for (const locale of KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES) {
      expect(getKlyxSplitMissionCheckoutDictionary(locale).safetySummary).toMatch(
        /repayée silencieusement|silently paid again|stilzwijgend opnieuw|stillschweigend erneut/
      );
    }
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionCheckoutLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionCheckoutDictionary("es")).toEqual(
      getKlyxSplitMissionCheckoutDictionary("fr")
    );
  });
});
