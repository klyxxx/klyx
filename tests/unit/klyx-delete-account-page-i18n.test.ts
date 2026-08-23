import { describe, expect, it } from "vitest";

import {
  getKlyxDeleteAccountPageDictionary,
  KLYX_DELETE_ACCOUNT_PAGE_MESSAGE_KEYS,
  KLYX_DELETE_ACCOUNT_PAGE_TRANSLATED_LOCALES,
  resolveKlyxDeleteAccountPageLocale,
} from "@/lib/klyx-delete-account-page-i18n";

describe("KLYX delete-account page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_DELETE_ACCOUNT_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxDeleteAccountPageDictionary(locale);

      for (const key of KLYX_DELETE_ACCOUNT_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps reasonable verification explicit for web deletion requests", () => {
    expect(getKlyxDeleteAccountPageDictionary("fr").webRequestDescription).toContain(
      "vérification raisonnable afin d’éviter qu’une autre personne supprime ton compte"
    );
    expect(getKlyxDeleteAccountPageDictionary("en").webRequestDescription).toContain(
      "reasonable verification to prevent another person from deleting your account"
    );
    expect(getKlyxDeleteAccountPageDictionary("nl").webRequestDescription).toContain(
      "redelijke verificatie vragen om te voorkomen dat iemand anders je account verwijdert"
    );
    expect(getKlyxDeleteAccountPageDictionary("de").webRequestDescription).toContain(
      "angemessene Überprüfung verlangen, um zu verhindern, dass eine andere Person dein Konto löscht"
    );
  });

  it("keeps identity verification acknowledged in every email template", () => {
    expect(
      getKlyxDeleteAccountPageDictionary("fr").emailIdentityAcknowledgement
    ).toContain("vérification de mon identité peut être nécessaire");
    expect(
      getKlyxDeleteAccountPageDictionary("en").emailIdentityAcknowledgement
    ).toContain("verification of my identity may be necessary");
    expect(
      getKlyxDeleteAccountPageDictionary("nl").emailIdentityAcknowledgement
    ).toContain("verificatie van mijn identiteit nodig kan zijn");
    expect(
      getKlyxDeleteAccountPageDictionary("de").emailIdentityAcknowledgement
    ).toContain("Überprüfung meiner Identität erforderlich sein kann");
  });

  it("keeps deletion/anonymization and exceptional retention explicit", () => {
    expect(getKlyxDeleteAccountPageDictionary("fr").retainedDescription).toContain(
      "supprimées ou anonymisées"
    );
    expect(getKlyxDeleteAccountPageDictionary("en").retainedDescription).toContain(
      "deleted or anonymized"
    );
    expect(getKlyxDeleteAccountPageDictionary("nl").retainedDescription).toContain(
      "verwijderd of geanonimiseerd"
    );
    expect(getKlyxDeleteAccountPageDictionary("de").retainedDescription).toContain(
      "gelöscht oder anonymisiert"
    );

    expect(getKlyxDeleteAccountPageDictionary("fr").retainedDescription).toContain(
      "obligation légale, la prévention de la fraude, la sécurité ou la gestion d’un litige"
    );
    expect(getKlyxDeleteAccountPageDictionary("en").retainedDescription).toContain(
      "legal obligation, fraud prevention, security, or the management of a dispute"
    );
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxDeleteAccountPageLocale("es")).toBe("fr");
    expect(getKlyxDeleteAccountPageDictionary("es")).toEqual(
      getKlyxDeleteAccountPageDictionary("fr")
    );
  });
});
