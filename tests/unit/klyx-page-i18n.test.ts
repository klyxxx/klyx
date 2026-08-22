import { describe, expect, it } from "vitest";

import {
  KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES,
  getKlyxPublicEntryDictionary,
  hasKlyxPublicPageTranslation,
  resolveKlyxPublicPageLocale,
  translateKlyxPublicEntry,
  type KlyxPublicEntryMessageKey,
} from "../../lib/klyx-page-i18n";

const REQUIRED_PUBLIC_ENTRY_KEYS: KlyxPublicEntryMessageKey[] = [
  "sessionLoading",
  "openKlyx",
  "myProfiles",
  "login",
  "start",
  "client",
  "clientNeedService",
  "provider",
  "providerOfferServices",
  "alreadyAccount",
  "signIn",
];

describe("KLYX public page i18n", () => {
  it("keeps every certified public-entry dictionary complete", () => {
    for (const locale of KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxPublicEntryDictionary(locale);

      for (const key of REQUIRED_PUBLIC_ENTRY_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real English, Dutch and German public entry copy", () => {
    expect(translateKlyxPublicEntry("en", "clientNeedService")).toBe(
      "I need a service"
    );
    expect(translateKlyxPublicEntry("nl", "providerOfferServices")).toBe(
      "Ik wil mijn diensten aanbieden"
    );
    expect(translateKlyxPublicEntry("de", "alreadyAccount")).toBe(
      "Du hast bereits ein Konto?"
    );
  });

  it("makes partial page coverage explicit and falls back to French", () => {
    expect(hasKlyxPublicPageTranslation("en")).toBe(true);
    expect(hasKlyxPublicPageTranslation("ar")).toBe(false);
    expect(resolveKlyxPublicPageLocale("ar")).toBe("fr");
    expect(translateKlyxPublicEntry("ar", "signIn")).toBe("Se connecter");
  });
});
