import { describe, expect, it } from "vitest";

import {
  KLYX_SIGNUP_PAGE_TRANSLATED_LOCALES,
  getKlyxSignupDictionary,
  hasKlyxSignupPageTranslation,
  resolveKlyxSignupPageLocale,
  translateKlyxSignup,
  type KlyxSignupMessageKey,
} from "../../lib/klyx-signup-page-i18n";

const REQUIRED_KEYS: KlyxSignupMessageKey[] = [
  "invalidForm", "captchaRequired", "captchaFailed", "signupFailed", "accountCreated",
  "checkingSession", "joinKlyx", "headline", "description", "benefitFree", "benefitRoles",
  "benefitSecure", "createSpace", "beta", "startTitle", "startSubtitle", "client",
  "clientSubtitle", "provider", "providerSubtitle", "selectedProfile", "joinAsProvider",
  "joinAsClient", "providerNext", "clientNext", "profileContinuity", "namePlaceholder",
  "emailPlaceholder", "passwordPlaceholder", "hidePassword", "showPassword", "creating",
  "createProvider", "createClient", "alreadyRegistered", "signIn",
];

describe("KLYX signup page i18n", () => {
  it("keeps every certified signup dictionary complete", () => {
    for (const locale of KLYX_SIGNUP_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxSignupDictionary(locale);
      for (const key of REQUIRED_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real translated signup copy", () => {
    expect(translateKlyxSignup("en", "startTitle")).toBe("Get started with KLYX");
    expect(translateKlyxSignup("nl", "clientSubtitle")).toBe("Ik zoek een dienst");
    expect(translateKlyxSignup("de", "createClient")).toBe("Mein Kundenkonto erstellen");
  });

  it("keeps partial signup coverage explicit with French fallback", () => {
    expect(hasKlyxSignupPageTranslation("de")).toBe(true);
    expect(hasKlyxSignupPageTranslation("es")).toBe(false);
    expect(resolveKlyxSignupPageLocale("es")).toBe("fr");
    expect(translateKlyxSignup("es", "signIn")).toBe("Se connecter");
  });
});
