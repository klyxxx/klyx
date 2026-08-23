import { describe, expect, it } from "vitest";

import {
  KLYX_PHONE_SETTINGS_MESSAGE_KEYS,
  KLYX_PHONE_SETTINGS_TRANSLATED_LOCALES,
  resolveKlyxPhoneSettingsLocale,
  resolveKlyxPhoneSettingsPublicErrorKey,
  translateKlyxPhoneSettings,
} from "@/lib/klyx-phone-settings-i18n";

describe("KLYX phone settings i18n", () => {
  it("keeps every certified dictionary complete", () => {
    for (const locale of KLYX_PHONE_SETTINGS_TRANSLATED_LOCALES) {
      for (const key of KLYX_PHONE_SETTINGS_MESSAGE_KEYS) {
        expect(translateKlyxPhoneSettings(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("certifies only fr, en, nl and de with explicit French fallback", () => {
    expect(KLYX_PHONE_SETTINGS_TRANSLATED_LOCALES).toEqual(["fr", "en", "nl", "de"]);
    expect(resolveKlyxPhoneSettingsLocale("es")).toBe("fr");
    expect(translateKlyxPhoneSettings("es", "title")).toBe(
      translateKlyxPhoneSettings("fr", "title")
    );
  });

  it("interpolates dynamic phone and cooldown values", () => {
    expect(
      translateKlyxPhoneSettings("en", "codeSent", { phone: "+32****513" })
    ).toContain("+32****513");
    expect(
      translateKlyxPhoneSettings("nl", "resendIn", { seconds: 42 })
    ).toContain("42");
  });

  it("maps only known public phone/OTP errors and otherwise uses the operation fallback", () => {
    expect(
      resolveKlyxPhoneSettingsPublicErrorKey("Code OTP invalide.", "verifyFailed")
    ).toBe("invalidOtp");
    expect(
      resolveKlyxPhoneSettingsPublicErrorKey(
        "Trop de codes incorrects. Verification bloquee pendant 15 minutes.",
        "verifyFailed"
      )
    ).toBe("tooManyCodesLocked");
    expect(
      resolveKlyxPhoneSettingsPublicErrorKey("database secret", "sendFailed")
    ).toBe("sendFailed");
  });
});
