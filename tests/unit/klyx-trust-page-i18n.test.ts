import { describe, expect, it } from "vitest";

import {
  getKlyxTrustDictionary,
  getKlyxTrustIntlLocale,
  KLYX_TRUST_MESSAGE_KEYS,
  KLYX_TRUST_TRANSLATED_LOCALES,
  resolveKlyxTrustLocale,
  translateKlyxTrustReason,
  translateKlyxTrustStatus,
} from "@/lib/klyx-trust-page-i18n";

describe("KLYX trust page i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_TRUST_TRANSLATED_LOCALES) {
      const dictionary = getKlyxTrustDictionary(locale);
      for (const key of KLYX_TRUST_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("translates every current dispute reason and status without exposing raw identifiers", () => {
    const reasons = [
      "provider_absent",
      "client_absent",
      "major_delay",
      "unfinished_work",
      "unsatisfactory_work",
      "unsafe_behavior",
      "payment_problem",
      "other",
    ];
    const statuses = ["open", "under_review", "waiting_user", "resolved", "closed"];

    for (const locale of KLYX_TRUST_TRANSLATED_LOCALES) {
      for (const reason of reasons) {
        expect(translateKlyxTrustReason(locale, reason)).not.toBe(reason);
      }
      for (const status of statuses) {
        expect(translateKlyxTrustStatus(locale, status)).not.toBe(status);
      }
      expect(translateKlyxTrustReason(locale, "future_reason")).not.toBe("future_reason");
      expect(translateKlyxTrustStatus(locale, "future_status")).not.toBe("future_status");
    }
  });

  it("keeps Spanish trust and dispute boundaries explicit", () => {
    const dictionary = getKlyxTrustDictionary("es");

    expect(resolveKlyxTrustLocale("es")).toBe("es");
    expect(dictionary.description).toBe(
      "Informa de un problema relacionado con un servicio, conserva los hechos y sigue la decisión de KLYX.",
    );
    expect(dictionary.protectedText).toBe("El expediente permanece vinculado a la reserva.");
    expect(dictionary.filesTitle).toBe("Mis disputas e incidencias");
    expect(translateKlyxTrustReason("es", "payment_problem")).toBe("Problema de pago");
    expect(translateKlyxTrustStatus("es", "under_review")).toBe("En revisión");
  });

  it("uses Belgian locale tags for certified languages", () => {
    expect(getKlyxTrustIntlLocale("fr")).toBe("fr-BE");
    expect(getKlyxTrustIntlLocale("en")).toBe("en-BE");
    expect(getKlyxTrustIntlLocale("nl")).toBe("nl-BE");
    expect(getKlyxTrustIntlLocale("de")).toBe("de-BE");
    expect(getKlyxTrustIntlLocale("es")).toBe("es-BE");
  });

  it("falls back explicitly to French outside certified page locales", () => {
    expect(resolveKlyxTrustLocale("it")).toBe("fr");
    expect(getKlyxTrustDictionary("it")).toEqual(getKlyxTrustDictionary("fr"));
    expect(getKlyxTrustIntlLocale("it")).toBe("fr-BE");
  });
});
