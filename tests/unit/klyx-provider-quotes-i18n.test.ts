import { describe, expect, it } from "vitest";

import {
  formatKlyxProviderQuoteDate,
  formatKlyxProviderQuoteMoney,
  normalizeKlyxProviderQuotesLocale,
  translateKlyxProviderQuotes,
  translateKlyxProviderQuoteStatus,
} from "@/lib/klyx-provider-quotes-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;

describe("KLYX provider quotes i18n", () => {
  it("supports the four certified locales with explicit French fallback", () => {
    expect(normalizeKlyxProviderQuotesLocale("fr")).toBe("fr");
    expect(normalizeKlyxProviderQuotesLocale("en")).toBe("en");
    expect(normalizeKlyxProviderQuotesLocale("nl")).toBe("nl");
    expect(normalizeKlyxProviderQuotesLocale("de")).toBe("de");
    expect(normalizeKlyxProviderQuotesLocale("es")).toBe("fr");
    expect(translateKlyxProviderQuotes("es", "title")).toBe(
      translateKlyxProviderQuotes("fr", "title")
    );
  });

  it("keeps the explicit provider-confirmation boundary in every locale", () => {
    const expected = {
      fr: {
        send: "Vérifier et envoyer le devis",
        approval: "Risque engageant : approbation prestataire obligatoire. Rien n’a été envoyé au client.",
      },
      en: {
        send: "Review and send quote",
        approval: "Commitment risk: provider approval is required. Nothing has been sent to the client.",
      },
      nl: {
        send: "Controleren en offerte versturen",
        approval: "Bindend risico: goedkeuring door de dienstverlener is verplicht. Er is niets naar de klant verstuurd.",
      },
      de: {
        send: "Prüfen und Angebot senden",
        approval: "Verbindliches Risiko: Freigabe durch den Anbieter ist erforderlich. Es wurde nichts an den Kunden gesendet.",
      },
    } as const;

    for (const locale of CERTIFIED_LOCALES) {
      expect(translateKlyxProviderQuotes(locale, "send")).toBe(
        expected[locale].send
      );
      expect(translateKlyxProviderQuotes(locale, "approvalRequired")).toBe(
        expected[locale].approval
      );
      expect(translateKlyxProviderQuotes(locale, "editableNotice").length).toBeGreaterThan(30);
    }
  });

  it("localizes known quote statuses and preserves unknown future statuses", () => {
    expect(translateKlyxProviderQuoteStatus("fr", "requested")).toBe("Demandé");
    expect(translateKlyxProviderQuoteStatus("en", "sent")).toBe("Sent");
    expect(translateKlyxProviderQuoteStatus("nl", "accepted")).toBe("Geaccepteerd");
    expect(translateKlyxProviderQuoteStatus("de", "rejected")).toBe("Abgelehnt");
    expect(translateKlyxProviderQuoteStatus("en", "future_status")).toBe("future_status");
  });

  it("formats dates and EUR amounts per locale without converting stored values", () => {
    for (const locale of CERTIFIED_LOCALES) {
      const money = formatKlyxProviderQuoteMoney(locale, 1234.56);
      const date = formatKlyxProviderQuoteDate(locale, "2026-08-25");

      expect(money).toContain("1");
      expect(money).toContain("€");
      expect(date.length).toBeGreaterThan(4);
    }

    expect(formatKlyxProviderQuoteDate("en", "not-a-date")).toBe("not-a-date");
  });
});
