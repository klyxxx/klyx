import { describe, expect, it } from "vitest";
import {
  getKlyxProviderTrustDictionary,
  KLYX_PROVIDER_TRUST_MESSAGE_KEYS,
  KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES,
  resolveKlyxProviderTrustLocale,
} from "@/lib/klyx-provider-trust-page-i18n";

describe("KLYX provider trust i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderTrustDictionary(locale);
      for (const key of KLYX_PROVIDER_TRUST_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("certifies Spanish provider trust boundaries", () => {
    expect(resolveKlyxProviderTrustLocale("es")).toBe("es");
    const spanish = getKlyxProviderTrustDictionary("es");
    expect(spanish.title).toBe("Centro de confianza para proveedores");
    expect(spanish.description).toBe("Consulta las incidencias recibidas y sigue los expedientes vinculados a tu actividad profesional.");
    expect(spanish.receivedTitle).toBe("Incidencias recibidas");
    expect(spanish.receivedDescription).toBe("Expedientes abiertos contra tu perfil profesional.");
    expect(spanish.openedTitle).toBe("Incidencias abiertas por mí");
    expect(spanish.openedDescription).toBe("Expedientes que has abierto sobre un cliente.");
    expect(spanish.viewMission).toBe("Ver la misión");
  });

  it("falls back explicitly to French for unsupported locales", () => {
    expect(resolveKlyxProviderTrustLocale("it")).toBe("fr");
    expect(getKlyxProviderTrustDictionary("it")).toEqual(getKlyxProviderTrustDictionary("fr"));
  });
});
