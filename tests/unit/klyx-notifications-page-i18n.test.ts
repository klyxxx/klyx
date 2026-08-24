import { describe, expect, it } from "vitest";

import {
  formatKlyxNotificationsUnreadSummary,
  getKlyxNotificationsDictionary,
  getKlyxNotificationsLocaleTag,
  KLYX_NOTIFICATIONS_MESSAGE_KEYS,
  KLYX_NOTIFICATIONS_TRANSLATED_LOCALES,
  resolveKlyxNotificationsLocale,
} from "@/lib/klyx-notifications-page-i18n";

describe("KLYX notifications page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_NOTIFICATIONS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxNotificationsDictionary(locale);

      for (const key of KLYX_NOTIFICATIONS_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }

      expect(dictionary.unreadOne).toContain("{count}");
      expect(dictionary.unreadMany).toContain("{count}");
    }
  });

  it("keeps load and mutation failures generic and free of backend details", () => {
    for (const locale of KLYX_NOTIFICATIONS_TRANSLATED_LOCALES) {
      const dictionary = getKlyxNotificationsDictionary(locale);

      for (const message of [dictionary.loadError, dictionary.actionError]) {
        expect(message).not.toContain("Supabase");
        expect(message).not.toContain("Postgres");
        expect(message).not.toContain("SQL");
      }
    }
  });

  it("formats unread counts without hard-coding French grammar", () => {
    expect(formatKlyxNotificationsUnreadSummary("fr", 1)).toBe(
      "1 notification non lue."
    );
    expect(formatKlyxNotificationsUnreadSummary("fr", 2)).toBe(
      "2 notifications non lues."
    );
    expect(formatKlyxNotificationsUnreadSummary("en", 0)).toBe(
      "0 unread notifications."
    );
    expect(formatKlyxNotificationsUnreadSummary("nl", 1)).toBe(
      "1 ongelezen melding."
    );
    expect(formatKlyxNotificationsUnreadSummary("de", 2)).toBe(
      "2 ungelesene Benachrichtigungen."
    );
  });

  it("uses locale-aware formatting tags for the certified locales", () => {
    expect(getKlyxNotificationsLocaleTag("fr")).toBe("fr-BE");
    expect(getKlyxNotificationsLocaleTag("en")).toBe("en-GB");
    expect(getKlyxNotificationsLocaleTag("nl")).toBe("nl-BE");
    expect(getKlyxNotificationsLocaleTag("de")).toBe("de-DE");
  });

  it("falls back explicitly to French outside the certified locales", () => {
    expect(resolveKlyxNotificationsLocale("es")).toBe("fr");
    expect(getKlyxNotificationsDictionary("es")).toEqual(
      getKlyxNotificationsDictionary("fr")
    );
    expect(getKlyxNotificationsLocaleTag("es")).toBe("fr-BE");
    expect(formatKlyxNotificationsUnreadSummary("es", 2)).toBe(
      "2 notifications non lues."
    );
  });
});
