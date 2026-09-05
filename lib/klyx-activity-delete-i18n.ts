export const KLYX_ACTIVITY_DELETE_LOCALES = ["fr", "en", "nl", "de"] as const;

type Locale = (typeof KLYX_ACTIVITY_DELETE_LOCALES)[number];
export type KlyxActivityDeleteMessageKey =
  | "delete"
  | "deleting"
  | "confirm"
  | "failed";

type Dictionary = Record<KlyxActivityDeleteMessageKey, string>;

const dictionaries: Record<Locale, Dictionary> = {
  fr: {
    delete: "Supprimer",
    deleting: "Suppression...",
    confirm:
      "Retirer cette mission de ton activité ? Les données de réservation, paiement et remboursement restent conservées.",
    failed: "Impossible de supprimer cette mission de ton activité.",
  },
  en: {
    delete: "Delete",
    deleting: "Deleting...",
    confirm:
      "Remove this mission from your activity? Booking, payment and refund records will remain محفوظed.",
    failed: "Unable to remove this mission from your activity.",
  },
  nl: {
    delete: "Verwijderen",
    deleting: "Verwijderen...",
    confirm:
      "Deze missie uit je activiteit verwijderen? Boekings-, betalings- en terugbetalingsgegevens blijven bewaard.",
    failed: "Deze missie kan niet uit je activiteit worden verwijderd.",
  },
  de: {
    delete: "Löschen",
    deleting: "Wird gelöscht...",
    confirm:
      "Diesen Auftrag aus deiner Aktivität entfernen? Buchungs-, Zahlungs- und Erstattungsdaten bleiben erhalten.",
    failed: "Dieser Auftrag kann nicht aus deiner Aktivität entfernt werden.",
  },
};

function normalizeLocale(locale: string | null | undefined): Locale {
  const base = String(locale ?? "fr").trim().toLowerCase().split("-")[0];
  return KLYX_ACTIVITY_DELETE_LOCALES.includes(base as Locale)
    ? (base as Locale)
    : "fr";
}

export function translateKlyxActivityDelete(
  locale: string | null | undefined,
  key: KlyxActivityDeleteMessageKey
): string {
  return dictionaries[normalizeLocale(locale)][key];
}
