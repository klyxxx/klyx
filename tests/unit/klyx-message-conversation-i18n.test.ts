import { describe, expect, it } from "vitest";

import {
  getKlyxMessageConversationDictionary,
  getKlyxMessageConversationLocaleTag,
  KLYX_MESSAGE_CONVERSATION_MESSAGE_KEYS,
  KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES,
  resolveKlyxMessageConversationLocale,
} from "@/lib/klyx-message-conversation-i18n";

describe("KLYX message conversation i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES) {
      const dictionary = getKlyxMessageConversationDictionary(locale);

      for (const key of KLYX_MESSAGE_CONVERSATION_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps rate-limit and generic send failures distinct in every locale", () => {
    for (const locale of KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES) {
      const dictionary = getKlyxMessageConversationDictionary(locale);

      expect(dictionary.rateLimited).not.toBe(dictionary.sendError);
      expect(dictionary.rateLimited.length).toBeGreaterThan(20);
      expect(dictionary.sendError.length).toBeGreaterThan(10);
    }

    expect(getKlyxMessageConversationDictionary("fr").rateLimited).toContain(
      "une minute"
    );
    expect(getKlyxMessageConversationDictionary("en").rateLimited).toContain(
      "one minute"
    );
  });

  it("keeps safe generic read failures free of backend implementation details", () => {
    for (const locale of KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES) {
      const message = getKlyxMessageConversationDictionary(locale).loadError;

      expect(message).not.toContain("Supabase");
      expect(message).not.toContain("Postgres");
      expect(message).not.toContain("SQL");
    }
  });

  it("uses locale-aware formatting tags for the certified locales", () => {
    expect(getKlyxMessageConversationLocaleTag("fr")).toBe("fr-BE");
    expect(getKlyxMessageConversationLocaleTag("en")).toBe("en-GB");
    expect(getKlyxMessageConversationLocaleTag("nl")).toBe("nl-BE");
    expect(getKlyxMessageConversationLocaleTag("de")).toBe("de-DE");
  });

  it("falls back explicitly to French outside the certified locales", () => {
    expect(resolveKlyxMessageConversationLocale("es")).toBe("fr");
    expect(getKlyxMessageConversationDictionary("es")).toEqual(
      getKlyxMessageConversationDictionary("fr")
    );
    expect(getKlyxMessageConversationLocaleTag("es")).toBe("fr-BE");
  });
});
