import { describe, expect, it } from "vitest";
import {
  getKlyxTrustNewDictionary,
  KLYX_TRUST_NEW_MESSAGE_KEYS,
  KLYX_TRUST_NEW_TRANSLATED_LOCALES,
  resolveKlyxTrustNewLocale,
} from "@/lib/klyx-trust-new-i18n";

describe("KLYX trust new i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_TRUST_NEW_TRANSLATED_LOCALES) {
      const dictionary = getKlyxTrustNewDictionary(locale);
      for (const key of KLYX_TRUST_NEW_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps cancellation and refund non-automatic in every certified locale", () => {
    expect(getKlyxTrustNewDictionary("fr").description).toContain("n’annule pas automatiquement");
    expect(getKlyxTrustNewDictionary("fr").description).toContain("ne déclenche pas automatiquement un remboursement");
    expect(getKlyxTrustNewDictionary("en").description).toContain("does not automatically cancel");
    expect(getKlyxTrustNewDictionary("en").description).toContain("does not automatically trigger a refund");
    expect(getKlyxTrustNewDictionary("nl").description).toContain("niet automatisch");
    expect(getKlyxTrustNewDictionary("de").description).toContain("nicht automatisch");
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxTrustNewLocale("es")).toBe("fr");
    expect(getKlyxTrustNewDictionary("es")).toEqual(getKlyxTrustNewDictionary("fr"));
  });
});
