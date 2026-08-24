import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_ADMIN_DISPUTES_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;

export type KlyxAdminDisputesLocale =
  (typeof KLYX_ADMIN_DISPUTES_TRANSLATED_LOCALES)[number];

export const KLYX_ADMIN_DISPUTES_MESSAGE_KEYS = [
  "loadError",
  "updateError",
  "updateSuccess",
  "eyebrow",
  "title",
  "description",
  "refresh",
  "searchPlaceholder",
  "filterAria",
  "activeCases",
  "allCases",
  "emptyTitle",
  "openedBy",
  "against",
  "booking",
  "unknownPayment",
  "caseStatus",
  "decision",
  "noteLabel",
  "notePlaceholder",
  "saving",
  "saveDecision",
  "unknownProfile",
  "klyxProfile",
  "unknownDecision",
  "unknownBookingStatus",
  "unknownPaymentStatus",
  "unknownPriority",
] as const;

export type KlyxAdminDisputesMessageKey =
  (typeof KLYX_ADMIN_DISPUTES_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAdminDisputesMessageKey, string>;

const MESSAGES: Record<KlyxAdminDisputesLocale, Dictionary> = {
  fr: {
    loadError: "Impossible de charger les litiges pour le moment.",
    updateError: "Impossible de mettre à jour ce dossier pour le moment.",
    updateSuccess: "Dossier mis à jour.",
    eyebrow: "Administration KLYX",
    title: "Administration des litiges",
    description:
      "Analyse les faits, demande des informations et conserve une décision motivée. Les remboursements restent traités dans leur système sécurisé séparé.",
    refresh: "Actualiser",
    searchPlaceholder: "Rechercher un profil, motif ou dossier",
    filterAria: "Filtrer les dossiers",
    activeCases: "Dossiers actifs",
    allCases: "Tous les dossiers",
    emptyTitle: "Aucun dossier correspondant",
    openedBy: "Ouvert par",
    against: "contre",
    booking: "Réservation",
    unknownPayment: "paiement inconnu",
    caseStatus: "Statut du dossier",
    decision: "Décision",
    noteLabel: "Note visible dans le suivi",
    notePlaceholder: "Explique la demande d’information ou la décision.",
    saving: "Enregistrement...",
    saveDecision: "Enregistrer la décision",
    unknownProfile: "Profil inconnu",
    klyxProfile: "Profil KLYX",
    unknownDecision: "Décision à vérifier",
    unknownBookingStatus: "Statut de réservation à vérifier",
    unknownPaymentStatus: "Statut de paiement à vérifier",
    unknownPriority: "Priorité à vérifier",
  },
  en: {
    loadError: "Disputes are currently unavailable.",
    updateError: "This case cannot be updated right now.",
    updateSuccess: "Case updated.",
    eyebrow: "KLYX administration",
    title: "Dispute administration",
    description:
      "Review the facts, request information, and keep a reasoned decision. Refunds remain handled separately in their secured system.",
    refresh: "Refresh",
    searchPlaceholder: "Search a profile, reason, or case",
    filterAria: "Filter cases",
    activeCases: "Active cases",
    allCases: "All cases",
    emptyTitle: "No matching case",
    openedBy: "Opened by",
    against: "against",
    booking: "Booking",
    unknownPayment: "payment unknown",
    caseStatus: "Case status",
    decision: "Decision",
    noteLabel: "Note visible in case tracking",
    notePlaceholder: "Explain the information request or decision.",
    saving: "Saving...",
    saveDecision: "Save decision",
    unknownProfile: "Unknown profile",
    klyxProfile: "KLYX profile",
    unknownDecision: "Decision needs review",
    unknownBookingStatus: "Booking status needs review",
    unknownPaymentStatus: "Payment status needs review",
    unknownPriority: "Priority needs review",
  },
  nl: {
    loadError: "Geschillen zijn momenteel niet beschikbaar.",
    updateError: "Dit dossier kan momenteel niet worden bijgewerkt.",
    updateSuccess: "Dossier bijgewerkt.",
    eyebrow: "KLYX-beheer",
    title: "Beheer van geschillen",
    description:
      "Beoordeel de feiten, vraag informatie op en bewaar een gemotiveerde beslissing. Terugbetalingen blijven afzonderlijk in hun beveiligde systeem verwerkt.",
    refresh: "Vernieuwen",
    searchPlaceholder: "Zoek een profiel, reden of dossier",
    filterAria: "Dossiers filteren",
    activeCases: "Actieve dossiers",
    allCases: "Alle dossiers",
    emptyTitle: "Geen overeenkomend dossier",
    openedBy: "Geopend door",
    against: "tegen",
    booking: "Boeking",
    unknownPayment: "betaling onbekend",
    caseStatus: "Dossierstatus",
    decision: "Beslissing",
    noteLabel: "Notitie zichtbaar in de opvolging",
    notePlaceholder: "Leg het informatieverzoek of de beslissing uit.",
    saving: "Opslaan...",
    saveDecision: "Beslissing opslaan",
    unknownProfile: "Onbekend profiel",
    klyxProfile: "KLYX-profiel",
    unknownDecision: "Beslissing moet worden gecontroleerd",
    unknownBookingStatus: "Boekingsstatus moet worden gecontroleerd",
    unknownPaymentStatus: "Betalingsstatus moet worden gecontroleerd",
    unknownPriority: "Prioriteit moet worden gecontroleerd",
  },
  de: {
    loadError: "Streitfälle sind derzeit nicht verfügbar.",
    updateError: "Dieser Fall kann derzeit nicht aktualisiert werden.",
    updateSuccess: "Fall aktualisiert.",
    eyebrow: "KLYX-Administration",
    title: "Verwaltung von Streitfällen",
    description:
      "Prüfe die Fakten, fordere Informationen an und dokumentiere eine begründete Entscheidung. Rückerstattungen werden weiterhin separat im gesicherten System bearbeitet.",
    refresh: "Aktualisieren",
    searchPlaceholder: "Profil, Grund oder Fall suchen",
    filterAria: "Fälle filtern",
    activeCases: "Aktive Fälle",
    allCases: "Alle Fälle",
    emptyTitle: "Kein passender Fall",
    openedBy: "Eröffnet von",
    against: "gegen",
    booking: "Buchung",
    unknownPayment: "Zahlung unbekannt",
    caseStatus: "Fallstatus",
    decision: "Entscheidung",
    noteLabel: "In der Nachverfolgung sichtbare Notiz",
    notePlaceholder: "Erläutere die Informationsanfrage oder Entscheidung.",
    saving: "Speichern...",
    saveDecision: "Entscheidung speichern",
    unknownProfile: "Unbekanntes Profil",
    klyxProfile: "KLYX-Profil",
    unknownDecision: "Entscheidung muss geprüft werden",
    unknownBookingStatus: "Buchungsstatus muss geprüft werden",
    unknownPaymentStatus: "Zahlungsstatus muss geprüft werden",
    unknownPriority: "Priorität muss geprüft werden",
  },
};

const DECISIONS: Record<KlyxAdminDisputesLocale, Record<string, string>> = {
  fr: {
    none: "Aucune décision",
    no_action: "Aucune action",
    warning_recorded: "Avertissement enregistré",
    refund_review_required: "Remboursement à examiner séparément",
    provider_compensation_review: "Indemnisation prestataire à examiner",
    more_information_required: "Informations complémentaires nécessaires",
    safety_escalation: "Escalade sécurité",
  },
  en: {
    none: "No decision",
    no_action: "No action",
    warning_recorded: "Warning recorded",
    refund_review_required: "Refund to review separately",
    provider_compensation_review: "Provider compensation to review",
    more_information_required: "More information required",
    safety_escalation: "Safety escalation",
  },
  nl: {
    none: "Geen beslissing",
    no_action: "Geen actie",
    warning_recorded: "Waarschuwing geregistreerd",
    refund_review_required: "Terugbetaling afzonderlijk te beoordelen",
    provider_compensation_review: "Vergoeding dienstverlener te beoordelen",
    more_information_required: "Aanvullende informatie vereist",
    safety_escalation: "Veiligheidsescalatie",
  },
  de: {
    none: "Keine Entscheidung",
    no_action: "Keine Maßnahme",
    warning_recorded: "Warnung dokumentiert",
    refund_review_required: "Rückerstattung separat prüfen",
    provider_compensation_review: "Anbieterentschädigung prüfen",
    more_information_required: "Weitere Informationen erforderlich",
    safety_escalation: "Sicherheitseskalation",
  },
};

const BOOKING_STATUSES: Record<KlyxAdminDisputesLocale, Record<string, string>> = {
  fr: { pending: "En attente", confirmed: "Confirmée", accepted: "Acceptée", completed: "Terminée", cancelled: "Annulée", canceled: "Annulée" },
  en: { pending: "Pending", confirmed: "Confirmed", accepted: "Accepted", completed: "Completed", cancelled: "Cancelled", canceled: "Cancelled" },
  nl: { pending: "In afwachting", confirmed: "Bevestigd", accepted: "Geaccepteerd", completed: "Voltooid", cancelled: "Geannuleerd", canceled: "Geannuleerd" },
  de: { pending: "Ausstehend", confirmed: "Bestätigt", accepted: "Angenommen", completed: "Abgeschlossen", cancelled: "Storniert", canceled: "Storniert" },
};

const PAYMENT_STATUSES: Record<KlyxAdminDisputesLocale, Record<string, string>> = {
  fr: { pending: "Paiement en attente", paid: "Payé", succeeded: "Payé", failed: "Paiement échoué", refunded: "Remboursé", partially_refunded: "Partiellement remboursé" },
  en: { pending: "Payment pending", paid: "Paid", succeeded: "Paid", failed: "Payment failed", refunded: "Refunded", partially_refunded: "Partially refunded" },
  nl: { pending: "Betaling in afwachting", paid: "Betaald", succeeded: "Betaald", failed: "Betaling mislukt", refunded: "Terugbetaald", partially_refunded: "Gedeeltelijk terugbetaald" },
  de: { pending: "Zahlung ausstehend", paid: "Bezahlt", succeeded: "Bezahlt", failed: "Zahlung fehlgeschlagen", refunded: "Erstattet", partially_refunded: "Teilweise erstattet" },
};

const PRIORITIES: Record<KlyxAdminDisputesLocale, Record<string, string>> = {
  fr: { low: "Faible", normal: "Normale", medium: "Moyenne", high: "Élevée", urgent: "Urgente" },
  en: { low: "Low", normal: "Normal", medium: "Medium", high: "High", urgent: "Urgent" },
  nl: { low: "Laag", normal: "Normaal", medium: "Gemiddeld", high: "Hoog", urgent: "Urgent" },
  de: { low: "Niedrig", normal: "Normal", medium: "Mittel", high: "Hoch", urgent: "Dringend" },
};

const INTL_LOCALES: Record<KlyxAdminDisputesLocale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
};

const LOCALE_SET = new Set<string>(KLYX_ADMIN_DISPUTES_TRANSLATED_LOCALES);

export function resolveKlyxAdminDisputesLocale(locale: KlyxLocale): KlyxAdminDisputesLocale {
  return LOCALE_SET.has(locale) ? (locale as KlyxAdminDisputesLocale) : "fr";
}

export function translateKlyxAdminDisputes(
  locale: KlyxLocale,
  key: KlyxAdminDisputesMessageKey
) {
  return MESSAGES[resolveKlyxAdminDisputesLocale(locale)][key];
}

export function translateKlyxAdminDisputeDecision(locale: KlyxLocale, code: string) {
  const resolved = resolveKlyxAdminDisputesLocale(locale);
  return DECISIONS[resolved][code || "none"] ?? MESSAGES[resolved].unknownDecision;
}

export function translateKlyxAdminBookingStatus(locale: KlyxLocale, status: string) {
  const resolved = resolveKlyxAdminDisputesLocale(locale);
  return BOOKING_STATUSES[resolved][status] ?? MESSAGES[resolved].unknownBookingStatus;
}

export function translateKlyxAdminPaymentStatus(locale: KlyxLocale, status: string | null) {
  const resolved = resolveKlyxAdminDisputesLocale(locale);
  if (!status) return MESSAGES[resolved].unknownPayment;
  return PAYMENT_STATUSES[resolved][status] ?? MESSAGES[resolved].unknownPaymentStatus;
}

export function translateKlyxAdminPriority(locale: KlyxLocale, priority: string) {
  const resolved = resolveKlyxAdminDisputesLocale(locale);
  return PRIORITIES[resolved][priority] ?? MESSAGES[resolved].unknownPriority;
}

export function getKlyxAdminDisputesIntlLocale(locale: KlyxLocale) {
  return INTL_LOCALES[resolveKlyxAdminDisputesLocale(locale)];
}
