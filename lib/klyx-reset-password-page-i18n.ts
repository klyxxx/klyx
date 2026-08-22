import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_RESET_PASSWORD_PAGE_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

type KlyxResetPasswordPageLocale =
  (typeof KLYX_RESET_PASSWORD_PAGE_TRANSLATED_LOCALES)[number];

export type KlyxResetPasswordMessageKey =
  | "passwordTooShort"
  | "passwordMismatch"
  | "passwordUpdated"
  | "title"
  | "subtitle"
  | "newPasswordPlaceholder"
  | "confirmPasswordPlaceholder"
  | "updating"
  | "updatePassword";

const RESET_PASSWORD_MESSAGES: Record<
  KlyxResetPasswordPageLocale,
  Record<KlyxResetPasswordMessageKey, string>
> = {
  fr: {
    passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    passwordUpdated: "Mot de passe mis à jour avec succès.",
    title: "Nouveau mot de passe",
    subtitle: "Choisis un nouveau mot de passe pour ton compte.",
    newPasswordPlaceholder: "Nouveau mot de passe",
    confirmPasswordPlaceholder: "Confirmer le mot de passe",
    updating: "Mise à jour...",
    updatePassword: "Mettre à jour le mot de passe",
  },
  en: {
    passwordTooShort: "The password must contain at least 6 characters.",
    passwordMismatch: "The passwords do not match.",
    passwordUpdated: "Password updated successfully.",
    title: "New password",
    subtitle: "Choose a new password for your account.",
    newPasswordPlaceholder: "New password",
    confirmPasswordPlaceholder: "Confirm password",
    updating: "Updating...",
    updatePassword: "Update password",
  },
  nl: {
    passwordTooShort: "Het wachtwoord moet minstens 6 tekens bevatten.",
    passwordMismatch: "De wachtwoorden komen niet overeen.",
    passwordUpdated: "Wachtwoord succesvol bijgewerkt.",
    title: "Nieuw wachtwoord",
    subtitle: "Kies een nieuw wachtwoord voor je account.",
    newPasswordPlaceholder: "Nieuw wachtwoord",
    confirmPasswordPlaceholder: "Wachtwoord bevestigen",
    updating: "Bijwerken...",
    updatePassword: "Wachtwoord bijwerken",
  },
  de: {
    passwordTooShort: "Das Passwort muss mindestens 6 Zeichen enthalten.",
    passwordMismatch: "Die Passwörter stimmen nicht überein.",
    passwordUpdated: "Passwort erfolgreich aktualisiert.",
    title: "Neues Passwort",
    subtitle: "Wähle ein neues Passwort für dein Konto.",
    newPasswordPlaceholder: "Neues Passwort",
    confirmPasswordPlaceholder: "Passwort bestätigen",
    updating: "Wird aktualisiert...",
    updatePassword: "Passwort aktualisieren",
  },
};

export function resolveKlyxResetPasswordPageLocale(
  locale: KlyxLocale
): KlyxResetPasswordPageLocale {
  return (KLYX_RESET_PASSWORD_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(
    locale
  )
    ? (locale as KlyxResetPasswordPageLocale)
    : "fr";
}

export function hasKlyxResetPasswordPageTranslation(locale: KlyxLocale) {
  return (KLYX_RESET_PASSWORD_PAGE_TRANSLATED_LOCALES as readonly string[]).includes(
    locale
  );
}

export function translateKlyxResetPassword(
  locale: KlyxLocale,
  key: KlyxResetPasswordMessageKey
) {
  return RESET_PASSWORD_MESSAGES[resolveKlyxResetPasswordPageLocale(locale)][key];
}

export function getKlyxResetPasswordDictionary(locale: KlyxLocale) {
  return RESET_PASSWORD_MESSAGES[resolveKlyxResetPasswordPageLocale(locale)];
}
