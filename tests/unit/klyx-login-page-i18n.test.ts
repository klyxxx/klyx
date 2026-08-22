import { describe, expect, it } from "vitest";

import {
  KLYX_LOGIN_PAGE_TRANSLATED_LOCALES,
  getKlyxLoginDictionary,
  hasKlyxLoginPageTranslation,
  resolveKlyxLoginPageLocale,
  translateKlyxLogin,
  type KlyxLoginMessageKey,
} from "../../lib/klyx-auth-page-i18n";

const REQUIRED_LOGIN_KEYS: KlyxLoginMessageKey[] = [
  "captchaRequired",
  "credentialsRequired",
  "captchaFailed",
  "invalidCredentials",
  "emailNotConfirmed",
  "loginFailed",
  "resetEmailRequired",
  "resetSent",
  "resetFailed",
  "checkingSession",
  "connectionBadge",
  "headline",
  "description",
  "benefitProfiles",
  "benefitSpaces",
  "benefitPassword",
  "secureSession",
  "protectedPassword",
  "welcome",
  "loginTitle",
  "loginSubtitle",
  "emailLabel",
  "emailPlaceholder",
  "passwordLabel",
  "passwordPlaceholder",
  "hidePassword",
  "showPassword",
  "forgotPassword",
  "loggingIn",
  "signIn",
  "switchNotice",
  "newToKlyx",
  "createAccount",
];

describe("KLYX login page i18n", () => {
  it("keeps every certified login dictionary complete", () => {
    for (const locale of KLYX_LOGIN_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxLoginDictionary(locale);
      for (const key of REQUIRED_LOGIN_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real translated login copy", () => {
    expect(translateKlyxLogin("en", "loginTitle")).toBe("Sign in to KLYX");
    expect(translateKlyxLogin("nl", "forgotPassword")).toBe(
      "Wachtwoord vergeten?"
    );
    expect(translateKlyxLogin("de", "invalidCredentials")).toBe(
      "E-Mail-Adresse oder Passwort ist falsch."
    );
  });

  it("keeps partial login coverage explicit with French fallback", () => {
    expect(hasKlyxLoginPageTranslation("de")).toBe(true);
    expect(hasKlyxLoginPageTranslation("es")).toBe(false);
    expect(resolveKlyxLoginPageLocale("es")).toBe("fr");
    expect(translateKlyxLogin("es", "signIn")).toBe("Se connecter");
  });
});
