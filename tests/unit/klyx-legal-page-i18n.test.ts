import { describe, expect, it } from "vitest";

import {
  getKlyxLegalPageDictionary,
  KLYX_LEGAL_PAGE_MESSAGE_KEYS,
  KLYX_LEGAL_PAGE_TRANSLATED_LOCALES,
  resolveKlyxLegalPageLocale,
} from "@/lib/klyx-legal-page-i18n";

describe("KLYX legal page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_LEGAL_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxLegalPageDictionary(locale);

      for (const key of KLYX_LEGAL_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the four legal destinations explicit in every locale", () => {
    for (const locale of KLYX_LEGAL_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxLegalPageDictionary(locale);

      expect(dictionary.privacyTitle.trim()).not.toBe("");
      expect(dictionary.termsTitle.trim()).not.toBe("");
      expect(dictionary.supportTitle.trim()).not.toBe("");
      expect(dictionary.deleteTitle.trim()).not.toBe("");
    }
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxLegalPageLocale("es")).toBe("fr");
    expect(getKlyxLegalPageDictionary("es")).toEqual(
      getKlyxLegalPageDictionary("fr")
    );
  });
});
