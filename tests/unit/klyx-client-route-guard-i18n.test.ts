import { describe, expect, it } from "vitest";

import {
  KLYX_CLIENT_ROUTE_GUARD_MESSAGE_KEYS,
  KLYX_CLIENT_ROUTE_GUARD_TRANSLATED_LOCALES,
  getKlyxClientRouteGuardDictionary,
  resolveKlyxClientRouteGuardLocale,
  translateKlyxClientRouteGuard,
} from "@/lib/klyx-client-route-guard-i18n";

describe("KLYX client route guard i18n", () => {
  it("keeps every selectable locale complete", () => {
    for (const locale of KLYX_CLIENT_ROUTE_GUARD_TRANSLATED_LOCALES) {
      const dictionary = getKlyxClientRouteGuardDictionary(locale);

      for (const key of KLYX_CLIENT_ROUTE_GUARD_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("localizes the visible guard states", () => {
    expect(translateKlyxClientRouteGuard("fr", "retry")).toBe("Réessayer");
    expect(translateKlyxClientRouteGuard("en", "checking")).toBe(
      "Checking the active profile..."
    );
    expect(translateKlyxClientRouteGuard("nl", "verificationErrorTitle")).toBe(
      "Verificatie niet mogelijk"
    );
    expect(translateKlyxClientRouteGuard("de", "redirecting")).toBe(
      "Weiterleitung zu deinem KLYX-Bereich..."
    );
  });

  it("falls back deterministically to French", () => {
    expect(resolveKlyxClientRouteGuardLocale("es")).toBe("fr");
    expect(translateKlyxClientRouteGuard("es", "profileCheckError")).toBe(
      "Impossible de vérifier le profil KLYX."
    );
  });
});
