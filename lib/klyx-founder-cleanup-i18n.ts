import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_FOUNDER_CLEANUP_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxFounderCleanupLocale = (typeof KLYX_FOUNDER_CLEANUP_TRANSLATED_LOCALES)[number];

export const KLYX_FOUNDER_CLEANUP_MESSAGE_KEYS = [
  "backAdmin", "badge", "title", "description", "refresh", "loadError", "deleteRejected", "deleteFailed",
  "deletedPrefix", "authUsers", "protectedAccounts", "deletableToConfirm", "permanentDeletion", "warningDescription",
  "noEmail", "protected", "deletable", "ownedProfiles", "profileFallback", "delete", "modalEyebrow", "modalTitle",
  "account", "confirmInstruction", "confirmationPlaceholder", "cancel", "deletePermanently",
] as const;
export type KlyxFounderCleanupMessageKey = (typeof KLYX_FOUNDER_CLEANUP_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxFounderCleanupMessageKey, string>;

const MESSAGES: Record<KlyxFounderCleanupLocale, Dictionary> = {
  fr: {
    backAdmin: "Centre Admin", badge: "Étape 11.4", title: "Nettoyage sécurisé des comptes",
    description: "Les comptes protégés ne peuvent jamais être supprimés depuis cette page. Pour un compte « À examiner », KLYX revérifie toutes les protections connues juste avant la suppression.",
    refresh: "Actualiser", loadError: "Audit impossible pour le moment.", deleteRejected: "Suppression refusée après revalidation des protections.", deleteFailed: "Suppression impossible pour le moment.",
    deletedPrefix: "Compte supprimé", authUsers: "Utilisateurs Auth", protectedAccounts: "Comptes protégés", deletableToConfirm: "Supprimables à confirmer",
    permanentDeletion: "Suppression définitive", warningDescription: "Supprime uniquement les anciens comptes que tu reconnais et que tu n’utilises plus. Si Supabase détecte encore une contrainte, la suppression sera refusée au lieu de forcer la suppression de données liées.",
    noEmail: "Utilisateur sans e-mail", protected: "PROTÉGÉ", deletable: "SUPPRIMABLE", ownedProfiles: "Profils possédés", profileFallback: "profil", delete: "Supprimer",
    modalEyebrow: "Suppression définitive", modalTitle: "Supprimer ce compte Auth ?", account: "Compte", confirmInstruction: "Pour confirmer, écris exactement :", confirmationPlaceholder: "Confirmation", cancel: "Annuler", deletePermanently: "Supprimer définitivement",
  },
  en: {
    backAdmin: "Admin Center", badge: "Step 11.4", title: "Secure account cleanup",
    description: "Protected accounts can never be deleted from this page. For an account marked for review, KLYX rechecks every known protection immediately before deletion.",
    refresh: "Refresh", loadError: "The audit cannot run right now.", deleteRejected: "Deletion was refused after protection revalidation.", deleteFailed: "Deletion cannot be completed right now.",
    deletedPrefix: "Account deleted", authUsers: "Auth users", protectedAccounts: "Protected accounts", deletableToConfirm: "Deletable after confirmation",
    permanentDeletion: "Permanent deletion", warningDescription: "Delete only old accounts you recognize and no longer use. If Supabase still detects a constraint, deletion will be refused instead of forcing deletion of linked data.",
    noEmail: "User without email", protected: "PROTECTED", deletable: "DELETABLE", ownedProfiles: "Owned profiles", profileFallback: "profile", delete: "Delete",
    modalEyebrow: "Permanent deletion", modalTitle: "Delete this Auth account?", account: "Account", confirmInstruction: "To confirm, type exactly:", confirmationPlaceholder: "Confirmation", cancel: "Cancel", deletePermanently: "Delete permanently",
  },
  nl: {
    backAdmin: "Admin Center", badge: "Stap 11.4", title: "Veilige accountopschoning",
    description: "Beveiligde accounts kunnen nooit vanaf deze pagina worden verwijderd. Voor een account dat moet worden beoordeeld, controleert KLYX alle bekende beveiligingen opnieuw vlak vóór de verwijdering.",
    refresh: "Vernieuwen", loadError: "De audit kan momenteel niet worden uitgevoerd.", deleteRejected: "Verwijdering is geweigerd na hercontrole van de beveiligingen.", deleteFailed: "Verwijdering kan momenteel niet worden uitgevoerd.",
    deletedPrefix: "Account verwijderd", authUsers: "Auth-gebruikers", protectedAccounts: "Beveiligde accounts", deletableToConfirm: "Verwijderbaar na bevestiging",
    permanentDeletion: "Definitieve verwijdering", warningDescription: "Verwijder alleen oude accounts die je herkent en niet meer gebruikt. Als Supabase nog een beperking detecteert, wordt de verwijdering geweigerd in plaats van gekoppelde gegevens geforceerd te verwijderen.",
    noEmail: "Gebruiker zonder e-mail", protected: "BEVEILIGD", deletable: "VERWIJDERBAAR", ownedProfiles: "Eigen profielen", profileFallback: "profiel", delete: "Verwijderen",
    modalEyebrow: "Definitieve verwijdering", modalTitle: "Dit Auth-account verwijderen?", account: "Account", confirmInstruction: "Typ om te bevestigen exact:", confirmationPlaceholder: "Bevestiging", cancel: "Annuleren", deletePermanently: "Definitief verwijderen",
  },
  de: {
    backAdmin: "Admin Center", badge: "Schritt 11.4", title: "Sichere Kontenbereinigung",
    description: "Geschützte Konten können über diese Seite niemals gelöscht werden. Bei einem zu prüfenden Konto kontrolliert KLYX unmittelbar vor der Löschung alle bekannten Schutzmechanismen erneut.",
    refresh: "Aktualisieren", loadError: "Die Prüfung kann derzeit nicht ausgeführt werden.", deleteRejected: "Die Löschung wurde nach erneuter Schutzprüfung abgelehnt.", deleteFailed: "Die Löschung kann derzeit nicht ausgeführt werden.",
    deletedPrefix: "Konto gelöscht", authUsers: "Auth-Benutzer", protectedAccounts: "Geschützte Konten", deletableToConfirm: "Nach Bestätigung löschbar",
    permanentDeletion: "Endgültige Löschung", warningDescription: "Lösche nur alte Konten, die du erkennst und nicht mehr verwendest. Wenn Supabase noch eine Einschränkung erkennt, wird die Löschung abgelehnt, anstatt verknüpfte Daten zwangsweise zu löschen.",
    noEmail: "Benutzer ohne E-Mail", protected: "GESCHÜTZT", deletable: "LÖSCHBAR", ownedProfiles: "Eigene Profile", profileFallback: "Profil", delete: "Löschen",
    modalEyebrow: "Endgültige Löschung", modalTitle: "Dieses Auth-Konto löschen?", account: "Konto", confirmInstruction: "Zur Bestätigung exakt eingeben:", confirmationPlaceholder: "Bestätigung", cancel: "Abbrechen", deletePermanently: "Endgültig löschen",
  },
};

const LOCALE_SET = new Set<string>(KLYX_FOUNDER_CLEANUP_TRANSLATED_LOCALES);

export function resolveKlyxFounderCleanupLocale(locale: KlyxLocale): KlyxFounderCleanupLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxFounderCleanupLocale) : "fr";
}
export function getKlyxFounderCleanupDictionary(locale: KlyxLocale) {
  return MESSAGES[resolveKlyxFounderCleanupLocale(locale)];
}
export function translateKlyxFounderCleanup(locale: KlyxLocale, key: KlyxFounderCleanupMessageKey) {
  return getKlyxFounderCleanupDictionary(locale)[key];
}
