import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionAcceptanceDictionary,
  KLYX_SPLIT_MISSION_ACCEPTANCE_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_ACCEPTANCE_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionAcceptanceLocale,
} from "@/lib/klyx-split-mission-acceptance-i18n";

describe("KLYX split mission acceptance i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_ACCEPTANCE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSplitMissionAcceptanceDictionary(locale);

      for (const key of KLYX_SPLIT_MISSION_ACCEPTANCE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps explicit payment confirmation boundaries in every locale", () => {
    expect(
      getKlyxSplitMissionAcceptanceDictionary("fr").allAcceptedDescription
    ).toContain("aucun paiement n'est automatique");
    expect(
      getKlyxSplitMissionAcceptanceDictionary("en").allAcceptedDescription
    ).toContain("no payment is automatic");
    expect(
      getKlyxSplitMissionAcceptanceDictionary("nl").allAcceptedDescription
    ).toContain("geen enkele betaling gebeurt automatisch");
    expect(
      getKlyxSplitMissionAcceptanceDictionary("de").allAcceptedDescription
    ).toContain("keine Zahlung erfolgt automatisch");
  });

  it("keeps silent replacement forbidden in every locale", () => {
    expect(
      getKlyxSplitMissionAcceptanceDictionary("fr").rebuildDescription
    ).toContain("jamais silencieusement");
    expect(
      getKlyxSplitMissionAcceptanceDictionary("en").rebuildDescription
    ).toContain("never replaces them silently");
    expect(
      getKlyxSplitMissionAcceptanceDictionary("nl").rebuildDescription
    ).toContain("nooit stilzwijgend");
    expect(
      getKlyxSplitMissionAcceptanceDictionary("de").rebuildDescription
    ).toContain("niemals stillschweigend");
  });

  it("keeps replacement, rebuild, booking and payment automation disabled", () => {
    for (const locale of KLYX_SPLIT_MISSION_ACCEPTANCE_TRANSLATED_LOCALES) {
      const summary = getKlyxSplitMissionAcceptanceDictionary(locale).automationSummary;

      expect(summary).toMatch(/Remplacement automatique|Automatic replacement|Automatische vervanging|Automatischer Ersatz/);
      expect(summary).toMatch(/Paiement automatique|Automatic payment|Automatische betaling|Automatische Zahlung/);
    }
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionAcceptanceLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionAcceptanceDictionary("es")).toEqual(
      getKlyxSplitMissionAcceptanceDictionary("fr")
    );
  });
});
