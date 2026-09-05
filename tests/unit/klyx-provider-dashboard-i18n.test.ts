import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_DASHBOARD_MESSAGE_KEYS,
  KLYX_PROVIDER_DASHBOARD_TRANSLATED_LOCALES,
  getKlyxProviderDashboardDictionary,
  resolveKlyxProviderDashboardLocale,
  translateKlyxProviderDashboard,
} from "@/lib/klyx-provider-dashboard-i18n";

describe("KLYX provider dashboard i18n", () => {
  it("keeps every certified locale complete", () => {
    expect(KLYX_PROVIDER_DASHBOARD_TRANSLATED_LOCALES).toEqual([
      "fr",
      "en",
      "nl",
      "de",
    ]);

    for (const locale of KLYX_PROVIDER_DASHBOARD_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderDashboardDictionary(locale);

      for (const key of KLYX_PROVIDER_DASHBOARD_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProviderDashboardLocale("es")).toBe("fr");
    expect(getKlyxProviderDashboardDictionary("es")).toEqual(
      getKlyxProviderDashboardDictionary("fr")
    );
    expect(translateKlyxProviderDashboard("es", "manageMore")).toBe(
      "Gérer autre chose"
    );
  });

  it("keeps representative provider navigation copy localized", () => {
    expect(translateKlyxProviderDashboard("fr", "settings")).toBe("Paramètres");
    expect(translateKlyxProviderDashboard("en", "settings")).toBe("Settings");
    expect(translateKlyxProviderDashboard("nl", "settings")).toBe("Instellingen");
    expect(translateKlyxProviderDashboard("de", "settings")).toBe("Einstellungen");

    expect(translateKlyxProviderDashboard("en", "providerAssistant")).toBe(
      "Provider assistant"
    );
    expect(translateKlyxProviderDashboard("nl", "quotes")).toBe("Offertes");
    expect(translateKlyxProviderDashboard("de", "serviceAreas")).toBe(
      "Einsatzgebiete"
    );
  });
});
