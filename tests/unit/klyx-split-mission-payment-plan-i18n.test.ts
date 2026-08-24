import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionPaymentPlanDictionary,
  KLYX_SPLIT_MISSION_PAYMENT_PLAN_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_PAYMENT_PLAN_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionPaymentPlanLocale,
} from "@/lib/klyx-split-mission-payment-plan-i18n";

describe("KLYX split mission payment plan i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_PAYMENT_PLAN_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSplitMissionPaymentPlanDictionary(locale);
      for (const key of KLYX_SPLIT_MISSION_PAYMENT_PLAN_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps payment creation disabled in every certified locale", () => {
    expect(getKlyxSplitMissionPaymentPlanDictionary("fr").noPaymentTitle).toContain(
      "Aucun paiement"
    );
    expect(getKlyxSplitMissionPaymentPlanDictionary("en").noPaymentTitle).toContain(
      "No payment"
    );
    expect(getKlyxSplitMissionPaymentPlanDictionary("nl").noPaymentTitle).toContain(
      "geen betaling"
    );
    expect(getKlyxSplitMissionPaymentPlanDictionary("de").noPaymentTitle).toContain(
      "keine Zahlung"
    );
  });

  it("keeps explicit confirmation and automatic Checkout boundaries", () => {
    for (const locale of KLYX_SPLIT_MISSION_PAYMENT_PLAN_TRANSLATED_LOCALES) {
      const summary = getKlyxSplitMissionPaymentPlanDictionary(locale).safetySummary;
      expect(summary.toLowerCase()).toContain("stripe");
      expect(summary).toMatch(/explicite|explicit|expliciete|ausdrückliche/);
      expect(summary).toMatch(/aucun|no automatic|geen automatische|kein automatischer/);
    }
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionPaymentPlanLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionPaymentPlanDictionary("es")).toEqual(
      getKlyxSplitMissionPaymentPlanDictionary("fr")
    );
  });
});
