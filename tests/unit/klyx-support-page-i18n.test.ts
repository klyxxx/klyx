import { describe, expect, it } from "vitest";

import {
  getKlyxSupportPageDictionary,
  KLYX_SUPPORT_PAGE_MESSAGE_KEYS,
  KLYX_SUPPORT_PAGE_TRANSLATED_LOCALES,
  resolveKlyxSupportPageLocale,
} from "@/lib/klyx-support-page-i18n";

describe("KLYX support page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_SUPPORT_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSupportPageDictionary(locale);

      for (const key of KLYX_SUPPORT_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the payment-card safety warning explicit in every locale", () => {
    expect(getKlyxSupportPageDictionary("fr").paymentBody).toContain(
      "aucune donnée complète de carte bancaire"
    );
    expect(getKlyxSupportPageDictionary("en").paymentBody).toContain(
      "not sending any full payment card details"
    );
    expect(getKlyxSupportPageDictionary("nl").paymentBody).toContain(
      "geen volledige betaalkaartgegevens"
    );
    expect(getKlyxSupportPageDictionary("de").paymentBody).toContain(
      "keine vollständigen Zahlungskartendaten"
    );
    expect(getKlyxSupportPageDictionary("es").paymentBody).toContain(
      "No envío ningún dato completo de mi tarjeta de pago"
    );
  });

  it("certifies the Spanish support experience", () => {
    expect(resolveKlyxSupportPageLocale("es")).toBe("es");
    expect(getKlyxSupportPageDictionary("es")).toMatchObject({
      metadataTitle: "Soporte de KLYX",
      title: "Soporte de KLYX",
      contactSupport: "Contactar con soporte",
      paymentTitle: "Pago",
      securityTitle: "Seguridad",
      open: "Abrir",
    });
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxSupportPageLocale("it")).toBe("fr");
    expect(getKlyxSupportPageDictionary("it")).toEqual(
      getKlyxSupportPageDictionary("fr")
    );
  });
});
