import { describe, expect, it } from "vitest";

import {
  KLYX_ACCOUNT_SWITCHER_MESSAGE_KEYS,
  KLYX_ACCOUNT_SWITCHER_TRANSLATED_LOCALES,
  getKlyxAccountSwitcherDictionary,
  resolveKlyxAccountSwitcherLocale,
  translateKlyxAccountSwitcher,
} from "@/lib/klyx-account-switcher-i18n";

describe("KLYX account switcher i18n", () => {
  it("keeps every selectable locale complete", () => {
    for (const locale of KLYX_ACCOUNT_SWITCHER_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAccountSwitcherDictionary(locale);

      for (const key of KLYX_ACCOUNT_SWITCHER_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("localizes the account switcher surface", () => {
    expect(translateKlyxAccountSwitcher("fr", "manageProfiles")).toBe(
      "Gérer les profils"
    );
    expect(translateKlyxAccountSwitcher("en", "providerRole")).toBe(
      "Provider"
    );
    expect(translateKlyxAccountSwitcher("nl", "menuAria")).toBe(
      "Van KLYX-profiel wisselen"
    );
    expect(translateKlyxAccountSwitcher("de", "switchError")).toBe(
      "Profil konnte nicht gewechselt werden."
    );
  });

  it("falls back deterministically to French", () => {
    expect(resolveKlyxAccountSwitcherLocale("es")).toBe("fr");
    expect(translateKlyxAccountSwitcher("es", "clientRole")).toBe("Client");
  });
});
