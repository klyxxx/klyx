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
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxSupportPageLocale("es")).toBe("fr");
    expect(getKlyxSupportPageDictionary("es")).toEqual(
      getKlyxSupportPageDictionary("fr")
    );
  });
});
