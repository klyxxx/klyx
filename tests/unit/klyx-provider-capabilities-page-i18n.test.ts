import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_CAPABILITIES_PAGE_MESSAGE_KEYS,
  KLYX_PROVIDER_CAPABILITIES_PAGE_TRANSLATED_LOCALES,
  resolveKlyxProviderCapabilitiesPageLocale,
  translateKlyxProviderCapabilitiesPage,
  translateKlyxProviderCapabilityStatus,
} from "@/lib/klyx-provider-capabilities-page-i18n";

describe("provider capabilities page i18n", () => {
  it("covers every message key for FR, EN, NL and DE", () => {
    for (const locale of KLYX_PROVIDER_CAPABILITIES_PAGE_TRANSLATED_LOCALES) {
      for (const key of KLYX_PROVIDER_CAPABILITIES_PAGE_MESSAGE_KEYS) {
        expect(translateKlyxProviderCapabilitiesPage(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("falls back explicitly to French outside certified locales", () => {
    expect(resolveKlyxProviderCapabilitiesPageLocale("es")).toBe("fr");
    expect(translateKlyxProviderCapabilitiesPage("es", "title")).toBe(
      translateKlyxProviderCapabilitiesPage("fr", "title")
    );
  });

  it("translates known capability statuses without exposing unknown backend values", () => {
    expect(translateKlyxProviderCapabilityStatus("fr", "draft")).toBe("À confirmer");
    expect(translateKlyxProviderCapabilityStatus("fr", "confirmed")).toBe("Confirmée");
    expect(translateKlyxProviderCapabilityStatus("en", "archived")).toBe("Archived");
    expect(translateKlyxProviderCapabilityStatus("nl", "server_private_value")).toBe(
      "Onbekende status"
    );
    expect(translateKlyxProviderCapabilityStatus("de", "server_private_value")).toBe(
      "Unbekannter Status"
    );
  });
});
