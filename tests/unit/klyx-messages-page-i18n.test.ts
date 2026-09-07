import { describe, expect, it } from "vitest";

import {
  getKlyxMessagesPageDictionary,
  KLYX_MESSAGES_PAGE_MESSAGE_KEYS,
  KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES,
  resolveKlyxMessagesPageLocale,
} from "@/lib/klyx-messages-page-i18n";

describe("KLYX messages overview i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxMessagesPageDictionary(locale);

      for (const key of KLYX_MESSAGES_PAGE_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the overview purpose explicit in every certified locale", () => {
    expect(getKlyxMessagesPageDictionary("fr").description).toContain(
      "réservations KLYX"
    );
    expect(getKlyxMessagesPageDictionary("en").description).toContain(
      "KLYX bookings"
    );
    expect(getKlyxMessagesPageDictionary("nl").description).toContain(
      "KLYX-reserveringen"
    );
    expect(getKlyxMessagesPageDictionary("de").description).toContain(
      "KLYX-Buchungen"
    );
    expect(getKlyxMessagesPageDictionary("es").description).toContain(
      "reservas KLYX"
    );
  });

  it("certifies the Spanish messages overview copy", () => {
    expect(resolveKlyxMessagesPageLocale("es")).toBe("es");

    const spanish = getKlyxMessagesPageDictionary("es");
    expect(spanish.title).toBe("Mensajes");
    expect(spanish.emptyTitle).toBe("No hay conversaciones");
    expect(spanish.unknownUser).toBe("Usuario de KLYX");
    expect(spanish.unreadSingle).toBe("sin leer");
    expect(spanish.unreadPlural).toBe("sin leer");
    expect(spanish.youPrefix).toBe("Tú:");
    expect(spanish.openConversation).toBe("Abrir");
  });

  it("uses a generic localized loading failure instead of backend details", () => {
    for (const locale of KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES) {
      const message = getKlyxMessagesPageDictionary(locale).loadError;

      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toContain("Supabase");
      expect(message).not.toContain("Postgres");
    }
  });

  it("falls back explicitly to French outside the certified page locales", () => {
    expect(resolveKlyxMessagesPageLocale("it")).toBe("fr");
    expect(getKlyxMessagesPageDictionary("it")).toEqual(
      getKlyxMessagesPageDictionary("fr")
    );
  });
});
