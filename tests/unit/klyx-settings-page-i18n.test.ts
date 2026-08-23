import { describe, expect, it } from "vitest";

import {
  KLYX_SETTINGS_PAGE_MESSAGE_KEYS,
  KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES,
  resolveKlyxSettingsDeleteErrorKey,
  resolveKlyxSettingsPageLocale,
  translateKlyxSettingsPage,
} from "@/lib/klyx-settings-page-i18n";

describe("KLYX settings page i18n", () => {
  it("certifies only the four current settings-container locales", () => {
    expect(KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES).toEqual([
      "fr",
      "en",
      "nl",
      "de",
    ]);
  });

  it("keeps all certified settings messages complete", () => {
    for (const locale of KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES) {
      for (const key of KLYX_SETTINGS_PAGE_MESSAGE_KEYS) {
        expect(translateKlyxSettingsPage(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("falls back explicitly to French outside certified page coverage", () => {
    expect(resolveKlyxSettingsPageLocale("es")).toBe("fr");
    expect(translateKlyxSettingsPage("es", "title")).toBe(
      translateKlyxSettingsPage("fr", "title")
    );
  });

  it("keeps the destructive confirmation token unchanged in every locale", () => {
    for (const locale of KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES) {
      expect(translateKlyxSettingsPage(locale, "deletePlaceholder")).toContain(
        "SUPPRIMER"
      );
    }
  });

  it("maps only known public account-delete errors and fails closed", () => {
    expect(
      resolveKlyxSettingsDeleteErrorKey(
        "Annule ou termine d’abord toutes les réservations actives."
      )
    ).toBe("activeBookingsBlock");
    expect(
      resolveKlyxSettingsDeleteErrorKey(
        "Stripe empêche encore la suppression de ce compte prestataire."
      )
    ).toBe("stripeDeleteBlocked");
    expect(resolveKlyxSettingsDeleteErrorKey("internal database detail")).toBe(
      "deleteFailed"
    );
  });
});
