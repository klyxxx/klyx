import { describe, expect, it } from "vitest";
import {
  getKlyxProviderTrustDictionary,
  KLYX_PROVIDER_TRUST_MESSAGE_KEYS,
  KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES,
  resolveKlyxProviderTrustLocale,
} from "@/lib/klyx-provider-trust-page-i18n";

describe("KLYX provider trust i18n", () => {
  it("keeps every certified locale complete", () => {
    for (const locale of KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES) {
      const dictionary = getKlyxProviderTrustDictionary(locale);
      for (const key of KLYX_PROVIDER_TRUST_MESSAGE_KEYS) {
        expect(dictionary[key].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxProviderTrustLocale("es")).toBe("fr");
    expect(getKlyxProviderTrustDictionary("es")).toEqual(getKlyxProviderTrustDictionary("fr"));
  });
});
