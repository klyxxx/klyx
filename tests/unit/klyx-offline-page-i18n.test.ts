import { describe, expect, it } from "vitest";

import {
  getKlyxOfflinePageDictionary,
  KLYX_OFFLINE_PAGE_MESSAGE_KEYS,
  KLYX_OFFLINE_PAGE_TRANSLATED_LOCALES,
  resolveKlyxOfflinePageLocale,
} from "@/lib/klyx-offline-page-i18n";

describe("KLYX offline page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_OFFLINE_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxOfflinePageDictionary(locale);

      for (const key of KLYX_OFFLINE_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the offline sensitive-data boundary explicit in every locale", () => {
    expect(getKlyxOfflinePageDictionary("fr").description).toContain("jamais servis depuis un cache hors ligne");
    expect(getKlyxOfflinePageDictionary("en").description).toContain("never served from an offline cache");
    expect(getKlyxOfflinePageDictionary("nl").description).toContain("nooit vanuit een offline cache");
    expect(getKlyxOfflinePageDictionary("de").description).toContain("niemals aus einem Offline-Cache");
    expect(getKlyxOfflinePageDictionary("es").description).toContain("nunca se sirven desde una caché sin conexión");
  });

  it("certifies the Spanish offline page copy", () => {
    expect(resolveKlyxOfflinePageLocale("es")).toBe("es");
    expect(getKlyxOfflinePageDictionary("es")).toMatchObject({
      metadataTitle: "KLYX sin conexión",
      badge: "Conexión no disponible",
      retryOnline: "Volver a KLYX",
      retryOffline: "Volver a intentarlo",
    });
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxOfflinePageLocale("it")).toBe("fr");
    expect(getKlyxOfflinePageDictionary("it")).toEqual(
      getKlyxOfflinePageDictionary("fr")
    );
  });
});
