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
    expect(resolveKlyxMessagesPageLocale("es")).toBe("fr");
    expect(getKlyxMessagesPageDictionary("es")).toEqual(
      getKlyxMessagesPageDictionary("fr")
    );
  });
});
