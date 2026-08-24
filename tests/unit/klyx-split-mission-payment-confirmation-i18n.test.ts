import { describe, expect, it } from "vitest";

import {
  getKlyxSplitMissionPaymentConfirmationDictionary,
  KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES,
  resolveKlyxSplitMissionPaymentConfirmationLocale,
} from "@/lib/klyx-split-mission-payment-confirmation-i18n";

describe("KLYX split mission payment confirmation i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES) {
      const dictionary =
        getKlyxSplitMissionPaymentConfirmationDictionary(locale);

      for (const key of KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps explicit no-debit boundaries in every locale", () => {
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("fr").noDebitSummary
    ).toContain("Aucun PaymentIntent");
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("en").noDebitSummary
    ).toContain("creates no PaymentIntent");
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("nl").noDebitSummary
    ).toContain("geen PaymentIntent");
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("de").noDebitSummary
    ).toContain("keinen PaymentIntent");
  });

  it("keeps silent amount changes forbidden in every locale", () => {
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("fr")
        .amountConsentDescription
    ).toContain("silencieusement");
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("en")
        .amountConsentDescription
    ).toContain("silently");
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("nl")
        .amountConsentDescription
    ).toContain("stilzwijgend");
    expect(
      getKlyxSplitMissionPaymentConfirmationDictionary("de")
        .amountConsentDescription
    ).toContain("stillschweigend");
  });

  it("keeps Stripe readiness failures explicit in every locale", () => {
    for (const locale of KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES) {
      const dictionary =
        getKlyxSplitMissionPaymentConfirmationDictionary(locale);
      expect(dictionary.blockProviderStripeNotReady).toContain("Stripe");
      expect(dictionary.blockProviderStripeLookupFailed).toContain("Stripe");
    }
  });

  it("falls back explicitly to French outside the certified component locales", () => {
    expect(resolveKlyxSplitMissionPaymentConfirmationLocale("es")).toBe("fr");
    expect(getKlyxSplitMissionPaymentConfirmationDictionary("es")).toEqual(
      getKlyxSplitMissionPaymentConfirmationDictionary("fr")
    );
  });
});
