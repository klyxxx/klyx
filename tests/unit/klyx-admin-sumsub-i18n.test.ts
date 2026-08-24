import { describe, expect, it } from "vitest";
import {
  displayKlyxAdminSumsubProviderName,
  getKlyxAdminSumsubDictionary,
  KLYX_ADMIN_SUMSUB_MESSAGE_KEYS,
  KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES,
  resolveKlyxAdminSumsubLocale,
  translateKlyxAdminSumsubAnswer,
  translateKlyxAdminSumsubKlyxStatus,
  translateKlyxAdminSumsubRejectType,
  translateKlyxAdminSumsubReviewStatus,
} from "@/lib/klyx-admin-sumsub-i18n";

describe("KLYX admin Sumsub i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminSumsubDictionary(locale);
      for (const key of KLYX_ADMIN_SUMSUB_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminSumsubLocale("es")).toBe("fr");
    expect(getKlyxAdminSumsubDictionary("es")).toEqual(
      getKlyxAdminSumsubDictionary("fr")
    );
  });

  it("localizes known statuses and protects unknown enum values", () => {
    for (const locale of KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminSumsubDictionary(locale);
      expect(translateKlyxAdminSumsubKlyxStatus(locale, "approved").trim()).not.toBe("");
      expect(translateKlyxAdminSumsubKlyxStatus(locale, "future_status")).toBe(
        dictionary.unknownKlyxStatus
      );
      expect(translateKlyxAdminSumsubReviewStatus(locale, "completed").trim()).not.toBe("");
      expect(translateKlyxAdminSumsubReviewStatus(locale, "future_review")).toBe(
        dictionary.unknownReviewStatus
      );
      expect(translateKlyxAdminSumsubAnswer(locale, "GREEN", "completed")).toBe(
        dictionary.greenAnswer
      );
      expect(translateKlyxAdminSumsubAnswer(locale, "RED", "completed")).toBe(
        dictionary.redAnswer
      );
      expect(translateKlyxAdminSumsubAnswer(locale, "FUTURE", "completed")).toBe(
        dictionary.unknownAnswer
      );
      expect(translateKlyxAdminSumsubRejectType(locale, "FINAL")).toBe(
        dictionary.finalReject
      );
      expect(translateKlyxAdminSumsubRejectType(locale, "RETRY")).toBe(
        dictionary.retryReject
      );
      expect(translateKlyxAdminSumsubRejectType(locale, "FUTURE")).toBe(
        dictionary.unknownRejectType
      );
    }
  });

  it("keeps real provider names verbatim and localizes only the server fallback", () => {
    for (const locale of KLYX_ADMIN_SUMSUB_TRANSLATED_LOCALES) {
      expect(displayKlyxAdminSumsubProviderName(locale, "Ada Lovelace")).toBe(
        "Ada Lovelace"
      );
      expect(displayKlyxAdminSumsubProviderName(locale, "Prestataire KLYX")).toBe(
        getKlyxAdminSumsubDictionary(locale).providerFallback
      );
    }
  });
});
