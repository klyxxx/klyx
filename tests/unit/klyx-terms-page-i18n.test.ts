import { describe, expect, it } from "vitest";

import {
  getKlyxTermsPageDictionary,
  KLYX_TERMS_PAGE_MESSAGE_KEYS,
  KLYX_TERMS_PAGE_TRANSLATED_LOCALES,
  resolveKlyxTermsPageLocale,
} from "@/lib/klyx-terms-page-i18n";

describe("KLYX terms page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_TERMS_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxTermsPageDictionary(locale);

      for (const key of KLYX_TERMS_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the paid-booking confirmation boundary explicit in every locale", () => {
    expect(getKlyxTermsPageDictionary("fr").section4Text).toContain(
      "ne doit pas être considérée comme payée tant que KLYX n’a pas reçu la confirmation"
    );
    expect(getKlyxTermsPageDictionary("en").section4Text).toContain(
      "must not be considered paid until KLYX has received the corresponding confirmation"
    );
    expect(getKlyxTermsPageDictionary("nl").section4Text).toContain(
      "mag niet als betaald worden beschouwd zolang KLYX de bijbehorende bevestiging niet heeft ontvangen"
    );
    expect(getKlyxTermsPageDictionary("de").section4Text).toContain(
      "darf erst dann als bezahlt gelten, wenn KLYX die entsprechende Bestätigung erhalten hat"
    );
    expect(getKlyxTermsPageDictionary("es").section4Text).toContain(
      "no debe considerarse pagada hasta que KLYX haya recibido la confirmación correspondiente"
    );
  });

  it("keeps refund disputes and non-guaranteed trust signals explicit", () => {
    expect(getKlyxTermsPageDictionary("fr").section5Text).toContain(
      "procédure de litige plutôt qu’une annulation automatique"
    );
    expect(getKlyxTermsPageDictionary("en").section5Text).toContain(
      "dispute procedure rather than automatic cancellation"
    );
    expect(getKlyxTermsPageDictionary("nl").section5Text).toContain(
      "geschillenprocedure vereisen in plaats van een automatische annulering"
    );
    expect(getKlyxTermsPageDictionary("de").section5Text).toContain(
      "Streitbeilegungsverfahren erfordern statt einer automatischen Stornierung"
    );
    expect(getKlyxTermsPageDictionary("es").section5Text).toContain(
      "procedimiento de disputa en lugar de una cancelación automática"
    );

    expect(getKlyxTermsPageDictionary("fr").section6Text).toContain("garantie absolue");
    expect(getKlyxTermsPageDictionary("en").section6Text).toContain("absolute guarantee");
    expect(getKlyxTermsPageDictionary("nl").section6Text).toContain("absolute garantie");
    expect(getKlyxTermsPageDictionary("de").section6Text).toContain("absolute Garantie");
    expect(getKlyxTermsPageDictionary("es").section6Text).toContain("garantía absoluta");
  });

  it("certifies the Spanish terms page copy", () => {
    expect(resolveKlyxTermsPageLocale("es")).toBe("es");
    expect(getKlyxTermsPageDictionary("es")).toMatchObject({
      metadataTitle: "Condiciones de uso",
      backLegal: "Información de KLYX",
      title: "Condiciones de uso",
      section4Title: "4. Reservas, precios y pago",
      section5Title: "5. Cancelaciones y reembolsos",
      privacyLink: "política de privacidad",
    });
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxTermsPageLocale("it")).toBe("fr");
    expect(getKlyxTermsPageDictionary("it")).toEqual(
      getKlyxTermsPageDictionary("fr")
    );
  });
});
