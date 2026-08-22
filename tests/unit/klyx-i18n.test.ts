import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeKlyxLocale,
  resolveKlyxLocale,
  translateKlyxNavigationLabel,
  translateKlyxUi,
} from "../../lib/klyx-i18n";
import {
  searchKlyxNavigation,
} from "../../lib/klyx-navigation";

describe("KLYX i18n foundation", () => {
  it("normalizes supported locale variants", () => {
    expect(normalizeKlyxLocale("fr-BE")).toBe("fr");
    expect(normalizeKlyxLocale("EN_us")).toBe("en");
    expect(normalizeKlyxLocale("nl-BE")).toBe("nl");
  });

  it("falls back safely to French", () => {
    expect(normalizeKlyxLocale("de-DE")).toBe("fr");
    expect(normalizeKlyxLocale(null)).toBe("fr");
  });

  it("resolves the first supported browser locale", () => {
    expect(resolveKlyxLocale(["de-DE", "nl-BE", "en-US"])).toBe("nl");
    expect(resolveKlyxLocale(["de-DE", "en-GB"])).toBe("en");
  });

  it("translates global UI labels", () => {
    expect(translateKlyxUi("en", "sidebar.logout")).toBe("Sign out");
    expect(translateKlyxUi("nl", "sidebar.noResults")).toBe("Geen resultaten.");
    expect(translateKlyxUi("fr", "skipToMain")).toBe("Aller au contenu principal");
  });

  it("translates navigation labels with a French fallback", () => {
    expect(translateKlyxNavigationLabel("en", "Paramètres")).toBe("Settings");
    expect(translateKlyxNavigationLabel("nl", "Mes réservations")).toBe("Mijn boekingen");
    expect(translateKlyxNavigationLabel("en", "Libellé inconnu")).toBe("Libellé inconnu");
  });

  it("finds navigation entries using English translated labels", () => {
    const results = searchKlyxNavigation("settings", "client", false, "en");

    expect(results.some((item) => item.href === "/settings")).toBe(true);
  });

  it("finds navigation entries using Dutch translated labels", () => {
    const results = searchKlyxNavigation("boekingen", "client", false, "nl");

    expect(results.some((item) => item.href === "/bookings")).toBe(true);
  });
});
