import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionStripeReadinessDictionary,
  KLYX_SPLIT_MISSION_STRIPE_READINESS_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_STRIPE_READINESS_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionStripeReadinessLocale,
} from "@/lib/klyx-split-mission-stripe-readiness-i18n";

describe("KLYX split mission Stripe readiness i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_STRIPE_READINESS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSplitMissionStripeReadinessDictionary(locale);
      for (const key of KLYX_SPLIT_MISSION_STRIPE_READINESS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps explicit client confirmation required in every locale", () => {
    expect(
      getKlyxSplitMissionStripeReadinessDictionary("fr").noDebitDescription
    ).toContain("confirmation explicite");
    expect(
      getKlyxSplitMissionStripeReadinessDictionary("en").noDebitDescription
    ).toContain("explicit client confirmation");
    expect(
      getKlyxSplitMissionStripeReadinessDictionary("nl").noDebitDescription
    ).toContain("uitdrukkelijke bevestiging");
    expect(
      getKlyxSplitMissionStripeReadinessDictionary("de").noDebitDescription
    ).toContain("ausdrückliche Bestätigung");
  });

  it("keeps financial creation disabled in every locale", () => {
    for (const locale of KLYX_SPLIT_MISSION_STRIPE_READINESS_TRANSLATED_LOCALES) {
      const summary = getKlyxSplitMissionStripeReadinessDictionary(locale).safetySummary;
      expect(summary).toContain("PaymentIntent");
      expect(summary).toContain("Checkout");
      expect(summary).toContain("Transfer");
    }
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionStripeReadinessLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionStripeReadinessDictionary("es")).toEqual(
      getKlyxSplitMissionStripeReadinessDictionary("fr")
    );
  });
});
