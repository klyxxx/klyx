import { describe, expect, it } from "vitest";

import {
  getKlyxPrivacyPageDictionary,
  KLYX_PRIVACY_PAGE_MESSAGE_KEYS,
  KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES,
  resolveKlyxPrivacyPageLocale,
} from "@/lib/klyx-privacy-page-i18n";

describe("KLYX privacy page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxPrivacyPageDictionary(locale);

      for (const key of KLYX_PRIVACY_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the payment-card storage boundary explicit in every locale", () => {
    expect(getKlyxPrivacyPageDictionary("fr").section2PaymentText).toContain(
      "données de carte sont traitées par le prestataire de paiement et ne sont pas destinées à être stockées directement par KLYX"
    );
    expect(getKlyxPrivacyPageDictionary("en").section2PaymentText).toContain(
      "Card data is processed by the payment provider and is not intended to be stored directly by KLYX"
    );
    expect(getKlyxPrivacyPageDictionary("nl").section2PaymentText).toContain(
      "Betaalkaartgegevens worden verwerkt door de betalingsdienstaanbieder en zijn niet bedoeld om rechtstreeks door KLYX te worden opgeslagen"
    );
    expect(getKlyxPrivacyPageDictionary("de").section2PaymentText).toContain(
      "Kartendaten werden vom Zahlungsdienstleister verarbeitet und sind nicht dafür bestimmt, direkt von KLYX gespeichert zu werden"
    );
  });

  it("keeps deletion, retention and external identity verification explicit", () => {
    expect(getKlyxPrivacyPageDictionary("fr").section5Text).toContain(
      "supprimées ou anonymisées"
    );
    expect(getKlyxPrivacyPageDictionary("en").section5Text).toContain(
      "deleted or anonymized"
    );
    expect(getKlyxPrivacyPageDictionary("nl").section5Text).toContain(
      "verwijderd of geanonimiseerd"
    );
    expect(getKlyxPrivacyPageDictionary("de").section5Text).toContain(
      "gelöscht oder anonymisiert"
    );

    expect(getKlyxPrivacyPageDictionary("fr").deletionAfterLink).toContain(
      "vérification d’identité peut être demandée avant de traiter une demande externe"
    );
    expect(getKlyxPrivacyPageDictionary("en").deletionAfterLink).toContain(
      "Identity verification may be requested before processing an external request"
    );
    expect(getKlyxPrivacyPageDictionary("nl").deletionAfterLink).toContain(
      "extern verzoek wordt verwerkt, kan identiteitsverificatie worden gevraagd"
    );
    expect(getKlyxPrivacyPageDictionary("de").deletionAfterLink).toContain(
      "Bearbeitung eines externen Antrags kann eine Identitätsprüfung verlangt werden"
    );
  });

  it("keeps the no-zero-risk security boundary explicit", () => {
    expect(getKlyxPrivacyPageDictionary("fr").section7Text).toContain(
      "Aucun système n’est toutefois exempt de risque"
    );
    expect(getKlyxPrivacyPageDictionary("en").section7Text).toContain(
      "No system is completely free of risk"
    );
    expect(getKlyxPrivacyPageDictionary("nl").section7Text).toContain(
      "Geen enkel systeem is echter vrij van risico"
    );
    expect(getKlyxPrivacyPageDictionary("de").section7Text).toContain(
      "Kein System ist jedoch völlig risikofrei"
    );
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxPrivacyPageLocale("es")).toBe("fr");
    expect(getKlyxPrivacyPageDictionary("es")).toEqual(
      getKlyxPrivacyPageDictionary("fr")
    );
  });
});
