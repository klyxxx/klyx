import { describe, expect, it } from "vitest";
import {
  getKlyxFounderTransactionTestDictionary,
  KLYX_FOUNDER_TRANSACTION_TEST_MESSAGE_KEYS,
  KLYX_FOUNDER_TRANSACTION_TEST_TRANSLATED_LOCALES,
  resolveKlyxFounderTransactionTestLocale,
} from "@/lib/klyx-founder-transaction-test-i18n";

describe("KLYX Founder transaction-test i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_FOUNDER_TRANSACTION_TEST_TRANSLATED_LOCALES) {
      const dictionary = getKlyxFounderTransactionTestDictionary(locale);
      for (const key of KLYX_FOUNDER_TRANSACTION_TEST_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxFounderTransactionTestLocale("es")).toBe("fr");
    expect(getKlyxFounderTransactionTestDictionary("es")).toEqual(
      getKlyxFounderTransactionTestDictionary("fr")
    );
  });
});
