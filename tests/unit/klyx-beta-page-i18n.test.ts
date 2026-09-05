import { describe, expect, it } from "vitest";

import {
  getKlyxBetaPageDictionary,
  KLYX_BETA_PAGE_MESSAGE_KEYS,
  KLYX_BETA_PAGE_TRANSLATED_LOCALES,
  resolveKlyxBetaPageLocale,
} from "@/lib/klyx-beta-page-i18n";

describe("KLYX beta page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_BETA_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxBetaPageDictionary(locale);

      for (const key of KLYX_BETA_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps external provider verification honesty explicit in every locale", () => {
    expect(getKlyxBetaPageDictionary("fr").verificationWarning).toContain(
      "ne les présente pas comme validées"
    );
    expect(getKlyxBetaPageDictionary("en").verificationWarning).toContain(
      "does not present them as verified"
    );
    expect(getKlyxBetaPageDictionary("nl").verificationWarning).toContain(
      "niet als geverifieerd"
    );
    expect(getKlyxBetaPageDictionary("de").verificationWarning).toContain(
      "erst dann als verifiziert"
    );
    expect(getKlyxBetaPageDictionary("es").verificationWarning).toContain(
      "no las presenta como verificadas"
    );
  });

  it("certifies the Spanish beta experience", () => {
    expect(resolveKlyxBetaPageLocale("es")).toBe("es");
    expect(getKlyxBetaPageDictionary("es")).toMatchObject({
      metadataTitle: "Beta de KLYX",
      login: "Iniciar sesión",
      clientTitle: "Soy cliente",
      providerTitle: "Soy profesional",
      installTitle: "Instalar KLYX",
    });
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxBetaPageLocale("it")).toBe("fr");
    expect(getKlyxBetaPageDictionary("it")).toEqual(
      getKlyxBetaPageDictionary("fr")
    );
  });
});
