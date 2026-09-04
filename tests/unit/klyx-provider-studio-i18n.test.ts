import { describe, expect, it } from "vitest";

import {
  getKlyxProviderStudioDayLabel,
  getKlyxProviderStudioDocumentStatusLabel,
  getKlyxProviderStudioDocumentTypeLabel,
  getKlyxProviderStudioServiceLabel,
  translateKlyxProviderStudio,
} from "@/lib/klyx-provider-studio-i18n";

describe("KLYX provider studio i18n", () => {
  it.each([
    ["fr", "Configurer mes services", "Ménage", "Lundi", "Pièce d’identité", "En vérification"],
    ["en", "Set up my services", "Cleaning", "Monday", "Identity document", "Under review"],
    ["nl", "Mijn diensten instellen", "Schoonmaak", "Maandag", "Identiteitsbewijs", "In beoordeling"],
    ["de", "Meine Dienstleistungen einrichten", "Reinigung", "Montag", "Ausweisdokument", "In Prüfung"],
  ] as const)(
    "localizes the studio surface for %s",
    (locale, title, service, day, documentType, documentStatus) => {
      expect(translateKlyxProviderStudio(locale, "pageTitle")).toBe(title);
      expect(getKlyxProviderStudioServiceLabel(locale, "cleaning")).toBe(service);
      expect(getKlyxProviderStudioDayLabel(locale, 1)).toBe(day);
      expect(getKlyxProviderStudioDocumentTypeLabel(locale, "identity")).toBe(
        documentType
      );
      expect(getKlyxProviderStudioDocumentStatusLabel(locale, "pending")).toBe(
        documentStatus
      );
    }
  );

  it("localizes dynamic accessibility labels without touching business values", () => {
    expect(
      translateKlyxProviderStudio("en", "removeServiceAria", {
        name: "Cleaning",
      })
    ).toBe("Remove Cleaning");
    expect(
      translateKlyxProviderStudio("nl", "removeZoneAria", {
        zone: "Elsene",
      })
    ).toBe("Elsene verwijderen");
    expect(
      translateKlyxProviderStudio("de", "minimumCounter", { minimum: 60 })
    ).toBe("Mindestens 60 · ");
  });

  it("keeps a deterministic French fallback for locales outside this Studio lot", () => {
    expect(translateKlyxProviderStudio("es", "pageTitle")).toBe(
      "Configurer mes services"
    );
    expect(getKlyxProviderStudioServiceLabel("es", "handyman")).toBe(
      "Bricolage"
    );
  });

  it("keeps unknown catalog values readable through caller fallbacks", () => {
    expect(
      getKlyxProviderStudioServiceLabel("en", "custom-service", "Custom service")
    ).toBe("Custom service");
    expect(
      getKlyxProviderStudioDocumentTypeLabel("de", "custom-document", "Dokument X")
    ).toBe("Dokument X");
  });
});
