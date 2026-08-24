import { describe, expect, it } from "vitest";
import {
  formatKlyxAdminFinanceConnect,
  getKlyxAdminFinanceDictionary,
  KLYX_ADMIN_FINANCE_MESSAGE_KEYS,
  KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES,
  resolveKlyxAdminFinanceLocale,
  translateKlyxAdminFinanceCheck,
  translateKlyxAdminFinanceMode,
} from "@/lib/klyx-admin-finance-i18n";

describe("KLYX admin finance i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminFinanceDictionary(locale);
      for (const key of KLYX_ADMIN_FINANCE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminFinanceLocale("es")).toBe("fr");
    expect(getKlyxAdminFinanceDictionary("es")).toEqual(
      getKlyxAdminFinanceDictionary("fr")
    );
  });

  it("localizes runtime modes and protects unknown check keys", () => {
    for (const locale of KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAdminFinanceDictionary(locale);
      expect(translateKlyxAdminFinanceMode(locale, "test")).toBe(dictionary.testMode);
      expect(translateKlyxAdminFinanceMode(locale, "live")).toBe(dictionary.liveMode);
      expect(translateKlyxAdminFinanceMode(locale, "future")).toBe(dictionary.unknownMode);
      expect(translateKlyxAdminFinanceCheck(locale, "secret_key").trim()).not.toBe("");
      expect(translateKlyxAdminFinanceCheck(locale, "future_check")).toBe(dictionary.unknownCheck);
    }
  });

  it("formats only aggregate Connect counts and never account identifiers", () => {
    for (const locale of KLYX_ADMIN_FINANCE_TRANSLATED_LOCALES) {
      const summary = formatKlyxAdminFinanceConnect(locale, 2, 3);
      expect(summary).toContain("2");
      expect(summary).toContain("3");
      expect(formatKlyxAdminFinanceConnect(locale, 0, 0)).toBe(
        getKlyxAdminFinanceDictionary(locale).connectNone
      );
    }
  });
});
