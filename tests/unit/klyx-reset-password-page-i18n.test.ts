import { describe, expect, it } from "vitest";

import {
  KLYX_RESET_PASSWORD_PAGE_TRANSLATED_LOCALES,
  getKlyxResetPasswordDictionary,
  hasKlyxResetPasswordPageTranslation,
  resolveKlyxResetPasswordPageLocale,
  translateKlyxResetPassword,
  type KlyxResetPasswordMessageKey,
} from "../../lib/klyx-reset-password-page-i18n";

const REQUIRED_KEYS: KlyxResetPasswordMessageKey[] = [
  "passwordTooShort",
  "passwordMismatch",
  "passwordUpdated",
  "title",
  "subtitle",
  "newPasswordPlaceholder",
  "confirmPasswordPlaceholder",
  "updating",
  "updatePassword",
];

describe("KLYX reset-password page i18n", () => {
  it("keeps every certified reset-password dictionary complete", () => {
    for (const locale of KLYX_RESET_PASSWORD_PAGE_TRANSLATED_LOCALES) {
      const dictionary = getKlyxResetPasswordDictionary(locale);
      for (const key of REQUIRED_KEYS) {
        expect(dictionary[key]?.trim(), `${locale} is missing ${key}`).toBeTruthy();
      }
    }
  });

  it("ships real translated reset-password copy", () => {
    expect(translateKlyxResetPassword("en", "title")).toBe("New password");
    expect(translateKlyxResetPassword("nl", "updatePassword")).toBe(
      "Wachtwoord bijwerken"
    );
    expect(translateKlyxResetPassword("de", "passwordMismatch")).toBe(
      "Die Passwörter stimmen nicht überein."
    );
    expect(translateKlyxResetPassword("es", "title")).toBe("Nueva contraseña");
    expect(translateKlyxResetPassword("es", "updatePassword")).toBe(
      "Actualizar contraseña"
    );
  });

  it("keeps partial reset-password coverage explicit with French fallback", () => {
    expect(hasKlyxResetPasswordPageTranslation("de")).toBe(true);
    expect(hasKlyxResetPasswordPageTranslation("es")).toBe(true);
    expect(resolveKlyxResetPasswordPageLocale("es")).toBe("es");
    expect(hasKlyxResetPasswordPageTranslation("it")).toBe(false);
    expect(resolveKlyxResetPasswordPageLocale("it")).toBe("fr");
    expect(translateKlyxResetPassword("it", "title")).toBe(
      "Nouveau mot de passe"
    );
  });
});
