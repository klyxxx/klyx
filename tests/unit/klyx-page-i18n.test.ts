import { describe, expect, it } from "vitest";

import {
  KLYX_PUBLIC_HOME_MESSAGE_KEYS,
  KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES,
  getKlyxPublicEntryDictionary,
  getKlyxPublicHomeDictionary,
  hasKlyxPublicPageTranslation,
  resolveKlyxPublicPageLocale,
  translateKlyxPublicEntry,
  translateKlyxPublicHome,
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

  it("keeps every certified full-home dictionary complete", () => {
    for (const locale of KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxPublicHomeDictionary(locale);

      for (const key of KLYX_PUBLIC_HOME_MESSAGE_KEYS) {
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

  it("ships real English, Dutch and German homepage copy", () => {
    expect(translateKlyxPublicHome("en", "heroBadge")).toBe(
      "One service for every need"
    );
    expect(translateKlyxPublicHome("nl", "journeyConfirmTitle")).toBe(
      "Jij bevestigt"
    );
    expect(translateKlyxPublicHome("de", "providerCta")).toBe(
      "Meinen Anbieterbereich erstellen"
    );
  });

  it("keeps explicit transaction boundaries in every certified homepage dictionary", () => {
    for (const locale of KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES) {
      const confirmation = translateKlyxPublicHome(locale, "journeyConfirmText");
      const safety = translateKlyxPublicHome(locale, "safetyDescription");

      expect(confirmation.trim()).toBeTruthy();
      expect(safety.trim()).toBeTruthy();
    }

    expect(translateKlyxPublicHome("en", "journeyConfirmText")).toContain(
      "explicitly confirm"
    );
    expect(translateKlyxPublicHome("nl", "safetyDescription")).toContain(
      "expliciete actie"
    );
    expect(translateKlyxPublicHome("de", "safetyDescription")).toContain(
      "ausdrückliche Aktion"
    );
  });

  it("makes four-language page coverage explicit and falls back to French", () => {
    expect(hasKlyxPublicPageTranslation("en")).toBe(true);
    expect(hasKlyxPublicPageTranslation("ar")).toBe(false);
    expect(resolveKlyxPublicPageLocale("ar")).toBe("fr");
    expect(translateKlyxPublicEntry("ar", "signIn")).toBe("Se connecter");
    expect(translateKlyxPublicHome("ar", "heroBadge")).toBe(
      "Un service pour chaque besoin"
    );
  });
});
