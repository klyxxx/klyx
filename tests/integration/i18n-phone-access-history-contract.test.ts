import { describe, expect, it } from "vitest";

import {
  KLYX_PHONE_HISTORY_MESSAGE_KEYS,
  KLYX_PHONE_HISTORY_TRANSLATED_LOCALES,
  resolveKlyxPhoneHistoryLocale,
  translateKlyxPhoneHistory,
  translateKlyxPhoneHistoryEvent,
  translateKlyxPhoneHistoryService,
  translateKlyxPhoneHistoryStatus,
  translateKlyxPhoneHistoryViewer,
} from "@/lib/klyx-phone-history-i18n";

describe("KLYX phone history i18n", () => {
  it("keeps every certified dictionary complete", () => {
    for (const locale of KLYX_PHONE_HISTORY_TRANSLATED_LOCALES) {
      for (const key of KLYX_PHONE_HISTORY_MESSAGE_KEYS) {
        expect(translateKlyxPhoneHistory(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("certifies only fr, en, nl and de with explicit French fallback", () => {
    expect(KLYX_PHONE_HISTORY_TRANSLATED_LOCALES).toEqual(["fr", "en", "nl", "de"]);
    expect(resolveKlyxPhoneHistoryLocale("es")).toBe("fr");
    expect(translateKlyxPhoneHistory("es", "title")).toBe(
      translateKlyxPhoneHistory("fr", "title")
    );
  });

  it("derives event, service and booking labels from stable codes", () => {
    expect(translateKlyxPhoneHistoryEvent("en", "phone_call_started")).toBe("Call started");
    expect(translateKlyxPhoneHistoryService("nl", "cleaning")).toBe("Schoonmaak");
    expect(translateKlyxPhoneHistoryStatus("de", "refunded")).toBe("Erstattet");
    expect(translateKlyxPhoneHistoryStatus("en", "future_status")).toBe("future_status");
  });

  it("localizes only the known generic viewer fallback", () => {
    expect(translateKlyxPhoneHistoryViewer("en", "Utilisateur KLYX")).toBe("KLYX user");
    expect(translateKlyxPhoneHistoryViewer("de", "Marie Dupont")).toBe("Marie Dupont");
  });
});
