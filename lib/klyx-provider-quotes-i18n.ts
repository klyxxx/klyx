export type KlyxProviderQuotesLocale = "fr" | "en" | "nl" | "de";

export type KlyxProviderQuotesMessageKey =
  | "providerOnly"
  | "title"
  | "intro"
  | "empty"
  | "prepare"
  | "smartDraft"
  | "approvalRequired"
  | "priceLabel"
  | "messageLabel"
  | "messagePlaceholder"
  | "editableNotice"
  | "send"
  | "date"
  | "time"
  | "duration"
  | "estimate"
  | "toConfirm"
  | "sentPrice"
  | "clientFallback"
  | "confidenceHigh"
  | "confidenceMedium"
  | "confidenceLow"
  | "loadError"
  | "draftError"
  | "draftReady"
  | "invalidAmount"
  | "sendError"
  | "sent";

const FR = {
  providerOnly: "Prestataire uniquement",
  title: "Demandes de devis",
  intro:
    "KLYX peut préparer un prix et un message à partir du tarif enregistré. Tu gardes toujours le contrôle : vérifie, modifie puis envoie toi-même le devis.",
  empty: "Aucune demande de devis",
  prepare: "Préparer avec KLYX",
  smartDraft: "Brouillon intelligent KLYX",
  approvalRequired:
    "Risque engageant : approbation prestataire obligatoire. Rien n’a été envoyé au client.",
  priceLabel: "Ton prix final",
  messageLabel: "Message au client",
  messagePlaceholder: "Précise ce qui est inclus dans ton prix.",
  editableNotice:
    "Le prix et le message restent entièrement modifiables. Seul le bouton ci-dessous envoie réellement le devis au client.",
  send: "Vérifier et envoyer le devis",
  date: "Date",
  time: "Heure",
  duration: "Durée",
  estimate: "Estimation KLYX",
  toConfirm: "à confirmer",
  sentPrice: "Prix envoyé",
  clientFallback: "Client KLYX",
  confidenceHigh: "Calcul fiable",
  confidenceMedium: "À vérifier",
  confidenceLow: "Informations insuffisantes",
  loadError: "Impossible de charger les devis.",
  draftError: "Brouillon KLYX indisponible.",
  draftReady: "Brouillon KLYX préparé. Vérifie-le avant l’envoi.",
  invalidAmount: "Entre un montant valide.",
  sendError: "Envoi impossible.",
  sent: "Devis envoyé.",
} satisfies Record<KlyxProviderQuotesMessageKey, string>;

const DICTIONARIES: Record<KlyxProviderQuotesLocale, typeof FR> = {
  fr: FR,
  en: {
    ...FR,
    providerOnly: "Providers only",
    title: "Quote requests",
    intro:
      "KLYX can prepare a price and a message from your saved rate. You always stay in control: review, edit, then send the quote yourself.",
    empty: "No quote requests",
    prepare: "Prepare with KLYX",
    smartDraft: "KLYX smart draft",
    approvalRequired:
      "Commitment risk: provider approval is required. Nothing has been sent to the client.",
    priceLabel: "Your final price",
    messageLabel: "Message to the client",
    messagePlaceholder: "Specify what is included in your price.",
    editableNotice:
      "The price and message remain fully editable. Only the button below actually sends the quote to the client.",
    send: "Review and send quote",
    date: "Date",
    time: "Time",
    duration: "Duration",
    estimate: "KLYX estimate",
    toConfirm: "to be confirmed",
    sentPrice: "Price sent",
    clientFallback: "KLYX client",
    confidenceHigh: "Reliable calculation",
    confidenceMedium: "Needs review",
    confidenceLow: "Insufficient information",
    loadError: "Unable to load quotes.",
    draftError: "KLYX draft unavailable.",
    draftReady: "KLYX draft prepared. Review it before sending.",
    invalidAmount: "Enter a valid amount.",
    sendError: "Unable to send.",
    sent: "Quote sent.",
  },
  nl: {
    ...FR,
    providerOnly: "Alleen dienstverleners",
    title: "Offerteaanvragen",
    intro:
      "KLYX kan op basis van je opgeslagen tarief een prijs en bericht voorbereiden. Jij houdt altijd de controle: controleer, wijzig en verstuur de offerte zelf.",
    empty: "Geen offerteaanvragen",
    prepare: "Voorbereiden met KLYX",
    smartDraft: "Slim KLYX-concept",
    approvalRequired:
      "Bindend risico: goedkeuring door de dienstverlener is verplicht. Er is niets naar de klant verstuurd.",
    priceLabel: "Je definitieve prijs",
    messageLabel: "Bericht aan de klant",
    messagePlaceholder: "Vermeld wat in je prijs is inbegrepen.",
    editableNotice:
      "Prijs en bericht blijven volledig bewerkbaar. Alleen de knop hieronder verstuurt de offerte daadwerkelijk naar de klant.",
    send: "Controleren en offerte versturen",
    date: "Datum",
    time: "Tijd",
    duration: "Duur",
    estimate: "KLYX-schatting",
    toConfirm: "te bevestigen",
    sentPrice: "Verstuurde prijs",
    clientFallback: "KLYX-klant",
    confidenceHigh: "Betrouwbare berekening",
    confidenceMedium: "Controleren",
    confidenceLow: "Onvoldoende informatie",
    loadError: "Offertes konden niet worden geladen.",
    draftError: "KLYX-concept niet beschikbaar.",
    draftReady: "KLYX-concept voorbereid. Controleer het voor verzending.",
    invalidAmount: "Voer een geldig bedrag in.",
    sendError: "Verzenden mislukt.",
    sent: "Offerte verstuurd.",
  },
  de: {
    ...FR,
    providerOnly: "Nur für Anbieter",
    title: "Angebotsanfragen",
    intro:
      "KLYX kann aus deinem gespeicherten Tarif einen Preis und eine Nachricht vorbereiten. Du behältst immer die Kontrolle: prüfen, bearbeiten und das Angebot selbst senden.",
    empty: "Keine Angebotsanfragen",
    prepare: "Mit KLYX vorbereiten",
    smartDraft: "Intelligenter KLYX-Entwurf",
    approvalRequired:
      "Verbindliches Risiko: Freigabe durch den Anbieter ist erforderlich. Es wurde nichts an den Kunden gesendet.",
    priceLabel: "Dein Endpreis",
    messageLabel: "Nachricht an den Kunden",
    messagePlaceholder: "Beschreibe, was in deinem Preis enthalten ist.",
    editableNotice:
      "Preis und Nachricht bleiben vollständig bearbeitbar. Nur die Schaltfläche unten sendet das Angebot tatsächlich an den Kunden.",
    send: "Prüfen und Angebot senden",
    date: "Datum",
    time: "Uhrzeit",
    duration: "Dauer",
    estimate: "KLYX-Schätzung",
    toConfirm: "zu bestätigen",
    sentPrice: "Gesendeter Preis",
    clientFallback: "KLYX-Kunde",
    confidenceHigh: "Zuverlässige Berechnung",
    confidenceMedium: "Prüfung erforderlich",
    confidenceLow: "Unzureichende Informationen",
    loadError: "Angebote konnten nicht geladen werden.",
    draftError: "KLYX-Entwurf nicht verfügbar.",
    draftReady: "KLYX-Entwurf vorbereitet. Vor dem Senden prüfen.",
    invalidAmount: "Gib einen gültigen Betrag ein.",
    sendError: "Senden nicht möglich.",
    sent: "Angebot gesendet.",
  },
};

export function normalizeKlyxProviderQuotesLocale(locale: string): KlyxProviderQuotesLocale {
  return locale === "en" || locale === "nl" || locale === "de" ? locale : "fr";
}

export function translateKlyxProviderQuotes(
  locale: string,
  key: KlyxProviderQuotesMessageKey
): string {
  return DICTIONARIES[normalizeKlyxProviderQuotesLocale(locale)][key];
}

// KLYX_PROVIDER_QUOTE_TRANSACTION_CURRENCY_15_06
export function formatKlyxProviderQuoteMoney(
  locale: string,
  amount: number,
  currency: string
): string {
  const localeMap: Record<KlyxProviderQuotesLocale, string> = {
    fr: "fr-BE",
    en: "en-BE",
    nl: "nl-BE",
    de: "de-BE",
  };

  return new Intl.NumberFormat(localeMap[normalizeKlyxProviderQuotesLocale(locale)], {
    style: "currency",
    currency: currency.trim().toUpperCase(),
  }).format(amount);
}

export function formatKlyxProviderQuoteDate(locale: string, value: string): string {
  const localeMap: Record<KlyxProviderQuotesLocale, string> = {
    fr: "fr-BE",
    en: "en-BE",
    nl: "nl-BE",
    de: "de-BE",
  };

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(localeMap[normalizeKlyxProviderQuotesLocale(locale)], {
        dateStyle: "medium",
      }).format(date);
}

export function translateKlyxProviderQuoteStatus(locale: string, status: string): string {
  const normalized = normalizeKlyxProviderQuotesLocale(locale);
  const labels: Record<string, Record<KlyxProviderQuotesLocale, string>> = {
    requested: { fr: "Demandé", en: "Requested", nl: "Aangevraagd", de: "Angefragt" },
    sent: { fr: "Envoyé", en: "Sent", nl: "Verstuurd", de: "Gesendet" },
    accepted: { fr: "Accepté", en: "Accepted", nl: "Geaccepteerd", de: "Angenommen" },
    rejected: { fr: "Refusé", en: "Rejected", nl: "Geweigerd", de: "Abgelehnt" },
    expired: { fr: "Expiré", en: "Expired", nl: "Verlopen", de: "Abgelaufen" },
  };

  return labels[status]?.[normalized] ?? status;
}
