import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionRefundStatusDictionary,
  KLYX_SPLIT_MISSION_REFUND_STATUS_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_REFUND_STATUS_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionRefundStatusLocale,
} from "@/lib/klyx-split-mission-refund-status-i18n";

describe("KLYX split mission refund status i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_REFUND_STATUS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSplitMissionRefundStatusDictionary(locale);
      for (const key of KLYX_SPLIT_MISSION_REFUND_STATUS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps Stripe final confirmation as the source of refund truth", () => {
    expect(
      getKlyxSplitMissionRefundStatusDictionary("fr").inProgressDescription
    ).toContain("confirmation finale de Stripe");
    expect(
      getKlyxSplitMissionRefundStatusDictionary("en").inProgressDescription
    ).toContain("Stripe's final confirmation");
    expect(
      getKlyxSplitMissionRefundStatusDictionary("nl").inProgressDescription
    ).toContain("definitieve bevestiging van Stripe");
    expect(
      getKlyxSplitMissionRefundStatusDictionary("de").inProgressDescription
    ).toContain("endgültige Bestätigung von Stripe");
  });

  it("keeps refunds explicit and non-automatic in every locale", () => {
    expect(getKlyxSplitMissionRefundStatusDictionary("fr").safetySummary).toContain(
      "aucun remboursement n'est automatique"
    );
    expect(getKlyxSplitMissionRefundStatusDictionary("en").safetySummary).toContain(
      "no refund is automatic"
    );
    expect(getKlyxSplitMissionRefundStatusDictionary("nl").safetySummary).toContain(
      "geen automatische terugbetaling"
    );
    expect(getKlyxSplitMissionRefundStatusDictionary("de").safetySummary).toContain(
      "keine automatische Rückerstattung"
    );
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionRefundStatusLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionRefundStatusDictionary("es")).toEqual(
      getKlyxSplitMissionRefundStatusDictionary("fr")
    );
  });
});
