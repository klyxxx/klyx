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

  it("certifies the Spanish legal page copy", () => {
    expect(resolveKlyxLegalPageLocale("es")).toBe("es");
    expect(getKlyxLegalPageDictionary("es")).toMatchObject({
      metadataTitle: "Información legal de KLYX",
      privacyTitle: "Política de privacidad",
      termsTitle: "Condiciones de uso",
      supportTitle: "Asistencia",
      deleteTitle: "Eliminación de la cuenta",
    });
  });

  it("keeps the Spanish account-deletion destination explicit", () => {
    expect(getKlyxLegalPageDictionary("es").deleteDescription).toContain(
      "eliminación de tu cuenta y de los datos asociados"
    );
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxLegalPageLocale("it")).toBe("fr");
    expect(getKlyxLegalPageDictionary("it")).toEqual(
      getKlyxLegalPageDictionary("fr")
    );
  });
});
