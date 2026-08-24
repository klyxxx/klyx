import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxSplitMissionPriceConfirmationLocale =
  (typeof KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_TRANSLATED_LOCALES)[number];

export const KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_MESSAGE_KEYS = [
  "sessionMissing",
  "loadError",
  "confirmError",
  "loading",
  "eyebrow",
  "title",
  "description",
  "refresh",
  "changedTitle",
  "changedDescription",
  "technicalMismatch",
  "acceptanceIncompleteTitle",
  "acceptanceIncompleteDescription",
  "missingPriceTitle",
  "missingPriceDescription",
  "missingCurrencyTitle",
  "mixedCurrencyTitle",
  "mixedCurrencyDescription",
  "slot",
  "planBudget",
  "overBudgetItem",
  "totalRecorded",
  "overBudgetConsent",
  "overBudgetCountPrefix",
  "overBudgetCountSuffix",
  "confirmedTitle",
  "confirmedDescription",
  "confirmButton",
  "noPaymentSafety",
] as const;

export type KlyxSplitMissionPriceConfirmationMessageKey =
  (typeof KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_MESSAGE_KEYS)[number];

type Dictionary = Record<
  KlyxSplitMissionPriceConfirmationMessageKey,
  string
>;

const MESSAGES: Record<
  KlyxSplitMissionPriceConfirmationLocale,
  Dictionary
> = {
  fr: {
    sessionMissing: "Session KLYX manquante.",
    loadError: "Les prix de la mission sont indisponibles pour le moment.",
    confirmError: "La confirmation des prix est impossible pour le moment.",
    loading: "Vérification des prix de la mission...",
    eyebrow: "Prix sécurisés",
    title: "Vérification des montants",
    description:
      "KLYX vérifie le montant enregistré sur chaque réservation avant toute future étape de paiement.",
    refresh: "Actualiser",
    changedTitle: "Un prix a changé",
    changedDescription:
      "L'ancienne confirmation a été invalidée. Les nouveaux montants doivent être confirmés à nouveau.",
    technicalMismatch:
      "L'intégrité de la mission doit être rétablie avant de confirmer les prix.",
    acceptanceIncompleteTitle: "Acceptation encore incomplète",
    acceptanceIncompleteDescription:
      "Les prix ne peuvent être verrouillés qu'après l'acceptation de tous les prestataires.",
    missingPriceTitle: "Prix manquant",
    missingPriceDescription:
      "Au moins une réservation ne possède pas encore de montant exploitable.",
    missingCurrencyTitle: "Devise manquante",
    mixedCurrencyTitle: "Plusieurs devises détectées",
    mixedCurrencyDescription:
      "KLYX bloque la confirmation tant que tous les créneaux ne partagent pas une seule devise.",
    slot: "Créneau",
    planBudget: "Budget du plan",
    overBudgetItem: "Ce montant dépasse le budget prévu pour ce créneau.",
    totalRecorded: "Total actuellement enregistré",
    overBudgetConsent: "J'accepte explicitement le dépassement de budget.",
    overBudgetCountPrefix: "",
    overBudgetCountSuffix:
      "créneau(x) dépasse(nt) le budget indiqué dans le plan confirmé.",
    confirmedTitle: "Prix confirmés",
    confirmedDescription:
      "La preuve correspond exactement aux montants actuellement enregistrés.",
    confirmButton: "Confirmer ces prix",
    noPaymentSafety:
      "Cette confirmation ne paie rien. Elle constitue uniquement une preuve explicite des prix acceptés par le client avant toute future architecture de paiement multi-prestataires.",
  },
  en: {
    sessionMissing: "KLYX session missing.",
    loadError: "Mission prices are currently unavailable.",
    confirmError: "Price confirmation is currently unavailable.",
    loading: "Checking mission prices...",
    eyebrow: "Secured prices",
    title: "Amount verification",
    description:
      "KLYX checks the amount recorded for each booking before any future payment step.",
    refresh: "Refresh",
    changedTitle: "A price changed",
    changedDescription:
      "The previous confirmation was invalidated. The new amounts must be confirmed again.",
    technicalMismatch:
      "Mission integrity must be restored before prices can be confirmed.",
    acceptanceIncompleteTitle: "Acceptance is still incomplete",
    acceptanceIncompleteDescription:
      "Prices can only be locked after all providers have accepted.",
    missingPriceTitle: "Missing price",
    missingPriceDescription:
      "At least one booking does not yet have a usable amount.",
    missingCurrencyTitle: "Missing currency",
    mixedCurrencyTitle: "Multiple currencies detected",
    mixedCurrencyDescription:
      "KLYX blocks confirmation until every slot uses a single shared currency.",
    slot: "Slot",
    planBudget: "Plan budget",
    overBudgetItem: "This amount exceeds the planned budget for this slot.",
    totalRecorded: "Total currently recorded",
    overBudgetConsent: "I explicitly accept the budget overrun.",
    overBudgetCountPrefix: "",
    overBudgetCountSuffix: "slot(s) exceed the budget in the confirmed plan.",
    confirmedTitle: "Prices confirmed",
    confirmedDescription:
      "The proof exactly matches the amounts currently recorded.",
    confirmButton: "Confirm these prices",
    noPaymentSafety:
      "This confirmation pays nothing. It only records explicit proof of the prices accepted by the client before any future multi-provider payment architecture.",
  },
  nl: {
    sessionMissing: "KLYX-sessie ontbreekt.",
    loadError: "De prijzen van de missie zijn momenteel niet beschikbaar.",
    confirmError: "Prijsbevestiging is momenteel niet mogelijk.",
    loading: "Prijzen van de missie controleren...",
    eyebrow: "Beveiligde prijzen",
    title: "Controle van bedragen",
    description:
      "KLYX controleert het bedrag dat voor elke boeking is opgeslagen vóór elke toekomstige betaalstap.",
    refresh: "Vernieuwen",
    changedTitle: "Een prijs is gewijzigd",
    changedDescription:
      "De vorige bevestiging is ongeldig gemaakt. De nieuwe bedragen moeten opnieuw worden bevestigd.",
    technicalMismatch:
      "De integriteit van de missie moet worden hersteld voordat prijzen kunnen worden bevestigd.",
    acceptanceIncompleteTitle: "Acceptatie is nog onvolledig",
    acceptanceIncompleteDescription:
      "Prijzen kunnen pas worden vergrendeld nadat alle dienstverleners hebben geaccepteerd.",
    missingPriceTitle: "Prijs ontbreekt",
    missingPriceDescription:
      "Minstens één boeking heeft nog geen bruikbaar bedrag.",
    missingCurrencyTitle: "Valuta ontbreekt",
    mixedCurrencyTitle: "Meerdere valuta gedetecteerd",
    mixedCurrencyDescription:
      "KLYX blokkeert de bevestiging zolang niet alle tijdsloten dezelfde valuta gebruiken.",
    slot: "Tijdslot",
    planBudget: "Budget van het plan",
    overBudgetItem: "Dit bedrag overschrijdt het voorziene budget voor dit tijdslot.",
    totalRecorded: "Momenteel geregistreerd totaal",
    overBudgetConsent: "Ik aanvaard de budgetoverschrijding uitdrukkelijk.",
    overBudgetCountPrefix: "",
    overBudgetCountSuffix:
      "tijdslot(en) overschrijden het budget in het bevestigde plan.",
    confirmedTitle: "Prijzen bevestigd",
    confirmedDescription:
      "Het bewijs komt exact overeen met de momenteel geregistreerde bedragen.",
    confirmButton: "Deze prijzen bevestigen",
    noPaymentSafety:
      "Deze bevestiging betaalt niets. Ze legt alleen uitdrukkelijk bewijs vast van de door de klant aanvaarde prijzen vóór enige toekomstige betaalarchitectuur met meerdere dienstverleners.",
  },
  de: {
    sessionMissing: "KLYX-Sitzung fehlt.",
    loadError: "Die Preise der Mission sind derzeit nicht verfügbar.",
    confirmError: "Die Preisbestätigung ist derzeit nicht möglich.",
    loading: "Preise der Mission werden geprüft...",
    eyebrow: "Gesicherte Preise",
    title: "Prüfung der Beträge",
    description:
      "KLYX prüft den für jede Buchung gespeicherten Betrag vor jedem zukünftigen Zahlungsschritt.",
    refresh: "Aktualisieren",
    changedTitle: "Ein Preis hat sich geändert",
    changedDescription:
      "Die vorherige Bestätigung wurde ungültig. Die neuen Beträge müssen erneut bestätigt werden.",
    technicalMismatch:
      "Die Integrität der Mission muss wiederhergestellt werden, bevor Preise bestätigt werden können.",
    acceptanceIncompleteTitle: "Annahme noch unvollständig",
    acceptanceIncompleteDescription:
      "Preise können erst gesperrt werden, nachdem alle Dienstleister angenommen haben.",
    missingPriceTitle: "Preis fehlt",
    missingPriceDescription:
      "Mindestens eine Buchung hat noch keinen verwendbaren Betrag.",
    missingCurrencyTitle: "Währung fehlt",
    mixedCurrencyTitle: "Mehrere Währungen erkannt",
    mixedCurrencyDescription:
      "KLYX blockiert die Bestätigung, bis alle Zeitfenster dieselbe Währung verwenden.",
    slot: "Zeitfenster",
    planBudget: "Planbudget",
    overBudgetItem: "Dieser Betrag überschreitet das vorgesehene Budget für dieses Zeitfenster.",
    totalRecorded: "Derzeit erfasster Gesamtbetrag",
    overBudgetConsent: "Ich akzeptiere die Budgetüberschreitung ausdrücklich.",
    overBudgetCountPrefix: "",
    overBudgetCountSuffix:
      "Zeitfenster überschreiten das Budget im bestätigten Plan.",
    confirmedTitle: "Preise bestätigt",
    confirmedDescription:
      "Der Nachweis entspricht genau den derzeit erfassten Beträgen.",
    confirmButton: "Diese Preise bestätigen",
    noPaymentSafety:
      "Diese Bestätigung führt keine Zahlung aus. Sie dokumentiert nur ausdrücklich die vom Kunden akzeptierten Preise vor einer möglichen zukünftigen Zahlungsarchitektur mit mehreren Dienstleistern.",
  },
};

const LOCALE_SET = new Set<string>(
  KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_TRANSLATED_LOCALES
);

export function hasKlyxSplitMissionPriceConfirmationTranslation(
  locale: KlyxLocale
) {
  return LOCALE_SET.has(locale);
}

export function resolveKlyxSplitMissionPriceConfirmationLocale(
  locale: KlyxLocale
): KlyxSplitMissionPriceConfirmationLocale {
  return hasKlyxSplitMissionPriceConfirmationTranslation(locale)
    ? (locale as KlyxSplitMissionPriceConfirmationLocale)
    : "fr";
}

export function getKlyxSplitMissionPriceConfirmationDictionary(
  locale: KlyxLocale
) {
  return MESSAGES[resolveKlyxSplitMissionPriceConfirmationLocale(locale)];
}

export function translateKlyxSplitMissionPriceConfirmation(
  locale: KlyxLocale,
  key: KlyxSplitMissionPriceConfirmationMessageKey
) {
  return getKlyxSplitMissionPriceConfirmationDictionary(locale)[key];
}
