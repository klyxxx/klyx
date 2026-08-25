import { describe, expect, it } from "vitest";

import {
  KLYX_REQUEST_CONFIRM_MESSAGE_KEYS,
  KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES,
  formatKlyxRequestConfirmService,
  getKlyxRequestConfirmDictionary,
  resolveKlyxRequestConfirmLocale,
  translateKlyxRequestConfirm,
} from "@/lib/klyx-request-confirm-i18n";

describe("KLYX request confirm i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES) {
      const dictionary = getKlyxRequestConfirmDictionary(locale);

      for (const key of KLYX_REQUEST_CONFIRM_MESSAGE_KEYS) {
        expect(dictionary[key]).toBeTypeOf("string");
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxRequestConfirmLocale("es")).toBe("fr");
    expect(translateKlyxRequestConfirm("es", "title")).toBe(
      "Confirme ta demande"
    );
  });

  it("localizes known built-in services", () => {
    expect(formatKlyxRequestConfirmService("en", "cleaning")).toBe("Cleaning");
    expect(formatKlyxRequestConfirmService("nl", "moving")).toBe("Verhuizen");
    expect(formatKlyxRequestConfirmService("de", "handyman")).toBe("Handwerker");
  });

  it("keeps custom service input verbatim", () => {
    expect(formatKlyxRequestConfirmService("de", "dog-walking-premium")).toBe(
      "dog-walking-premium"
    );
  });

  it("localizes the no-payment boundary without implying execution", () => {
    expect(translateKlyxRequestConfirm("en", "noPaymentTitle")).toBe(
      "No payment now"
    );
    expect(translateKlyxRequestConfirm("nl", "noPaymentText")).toContain(
      "pas aangeboden"
    );
  });
});
