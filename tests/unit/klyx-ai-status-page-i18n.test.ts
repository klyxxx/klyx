import { describe, expect, it } from "vitest";

import {
  getKlyxAiStatusPageDictionary,
  KLYX_AI_STATUS_PAGE_MESSAGE_KEYS,
  KLYX_AI_STATUS_PAGE_TRANSLATED_LOCALES,
  resolveKlyxAiStatusPageLocale,
} from "@/lib/klyx-ai-status-page-i18n";

describe("KLYX AI status page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_AI_STATUS_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxAiStatusPageDictionary(locale);

      for (const key of KLYX_AI_STATUS_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the explicit AI transaction boundary in every locale", () => {
    expect(getKlyxAiStatusPageDictionary("fr").safetyDescription).toContain(
      "ne peut pas confirmer seule un paiement"
    );
    expect(getKlyxAiStatusPageDictionary("en").safetyDescription).toContain(
      "cannot confirm a payment"
    );
    expect(getKlyxAiStatusPageDictionary("nl").safetyDescription).toContain(
      "kan niet zelfstandig een betaling"
    );
    expect(getKlyxAiStatusPageDictionary("de").safetyDescription).toContain(
      "kann eine Zahlung"
    );
    expect(getKlyxAiStatusPageDictionary("es").safetyDescription).toContain(
      "no puede confirmar por sí sola un pago"
    );
  });

  it("keeps the Spanish diagnostic synthetic and admin-only", () => {
    const dictionary = getKlyxAiStatusPageDictionary("es");

    expect(dictionary.probeDescription).toContain(
      "No se utilizan datos de usuario, reservas ni pagos"
    );
    expect(dictionary.probeAdminOnly).toContain(
      "reservado al administrador de KLYX"
    );
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxAiStatusPageLocale("it")).toBe("fr");
    expect(getKlyxAiStatusPageDictionary("it")).toEqual(
      getKlyxAiStatusPageDictionary("fr")
    );
  });
});
