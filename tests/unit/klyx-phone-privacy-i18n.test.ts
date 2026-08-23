import { describe, expect, it } from "vitest";

import {
  KLYX_PHONE_PRIVACY_MESSAGE_KEYS,
  KLYX_PHONE_PRIVACY_TRANSLATED_LOCALES,
  resolveKlyxPhonePrivacyLocale,
  resolveKlyxPhonePrivacyPublicErrorKey,
  translateKlyxPhonePrivacy,
} from "@/lib/klyx-phone-privacy-i18n";

describe("KLYX phone privacy i18n", () => {
  it("keeps every certified dictionary complete", () => {
    for (const locale of KLYX_PHONE_PRIVACY_TRANSLATED_LOCALES) {
      for (const key of KLYX_PHONE_PRIVACY_MESSAGE_KEYS) {
        expect(translateKlyxPhonePrivacy(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("certifies only fr, en, nl and de with explicit French fallback", () => {
    expect(KLYX_PHONE_PRIVACY_TRANSLATED_LOCALES).toEqual(["fr", "en", "nl", "de"]);
    expect(resolveKlyxPhonePrivacyLocale("es")).toBe("fr");
    expect(translateKlyxPhonePrivacy("es", "title")).toBe(
      translateKlyxPhonePrivacy("fr", "title")
    );
  });

  it("maps only known public privacy errors", () => {
    expect(
      resolveKlyxPhonePrivacyPublicErrorKey(
        "Option de confidentialite invalide.",
        "saveFailed"
      )
    ).toBe("invalidOption");
    expect(
      resolveKlyxPhonePrivacyPublicErrorKey("database detail", "loadFailed")
    ).toBe("loadFailed");
  });
});
