export type ProviderAssistantIntent =
  | "availability"
  | "quote"
  | "client_reply"
  | "unknown";

export type ProviderAssistantLocale = "fr" | "en" | "nl" | "de";

export type AvailabilityDraft = {
  dayOfWeek: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
};

export type QuoteDraft = {
  hours: number;
  hourlyRate: number | null;
  estimatedTotal: number | null;
};

export type ProviderAssistantResult = {
  intent: ProviderAssistantIntent;
  reply: string;
  title: string;
  payload: Record<string, unknown>;
  requiresConfirmation: true;
};

const LOCALES: ProviderAssistantLocale[] = ["fr", "en", "nl", "de"];

const DAYS = [
  {
    dayOfWeek: 1,
    labels: { fr: "lundi", en: "Monday", nl: "maandag", de: "Montag" },
    aliases: { fr: ["lundi"], en: ["monday"], nl: ["maandag"], de: ["montag"] },
  },
  {
    dayOfWeek: 2,
    labels: { fr: "mardi", en: "Tuesday", nl: "dinsdag", de: "Dienstag" },
    aliases: { fr: ["mardi"], en: ["tuesday"], nl: ["dinsdag"], de: ["dienstag"] },
  },
  {
    dayOfWeek: 3,
    labels: { fr: "mercredi", en: "Wednesday", nl: "woensdag", de: "Mittwoch" },
    aliases: { fr: ["mercredi"], en: ["wednesday"], nl: ["woensdag"], de: ["mittwoch"] },
  },
  {
    dayOfWeek: 4,
    labels: { fr: "jeudi", en: "Thursday", nl: "donderdag", de: "Donnerstag" },
    aliases: { fr: ["jeudi"], en: ["thursday"], nl: ["donderdag"], de: ["donnerstag"] },
  },
  {
    dayOfWeek: 5,
    labels: { fr: "vendredi", en: "Friday", nl: "vrijdag", de: "Freitag" },
    aliases: { fr: ["vendredi"], en: ["friday"], nl: ["vrijdag"], de: ["freitag"] },
  },
  {
    dayOfWeek: 6,
    labels: { fr: "samedi", en: "Saturday", nl: "zaterdag", de: "Samstag" },
    aliases: { fr: ["samedi"], en: ["saturday"], nl: ["zaterdag"], de: ["samstag"] },
  },
  {
    dayOfWeek: 0,
    labels: { fr: "dimanche", en: "Sunday", nl: "zondag", de: "Sonntag" },
    aliases: { fr: ["dimanche"], en: ["sunday"], nl: ["zondag"], de: ["sonntag"] },
  },
] as const;

const LOCALE_MARKERS: Record<ProviderAssistantLocale, readonly string[]> = {
  fr: [
    "je suis",
    "pour",
    "devis",
    "client",
    "disponible",
    "libre",
    "heure",
    "heures",
    "retard",
    "repond",
    "reponse",
    "prix",
    "tarif",
    "combien",
  ],
  en: [
    "i am",
    "for",
    "quote",
    "client",
    "available",
    "free",
    "hour",
    "hours",
    "late",
    "delay",
    "reply",
    "response",
    "price",
    "estimate",
    "how much",
  ],
  nl: [
    "ik ben",
    "voor",
    "offerte",
    "klant",
    "beschikbaar",
    "vrij",
    "uur",
    "uren",
    "vertraging",
    "antwoord",
    "prijs",
    "schatting",
    "hoeveel",
  ],
  de: [
    "ich bin",
    "fur",
    "angebot",
    "kunde",
    "kunden",
    "verfugbar",
    "frei",
    "stunde",
    "stunden",
    "verspat",
    "antwort",
    "preis",
    "kosten",
    "schatzung",
    "wie viel",
  ],
};

const QUOTE_WORDS = [
  "devis",
  "combien",
  "estimation",
  "prix",
  "tarif",
  "quote",
  "estimate",
  "price",
  "cost",
  "how much",
  "offerte",
  "schatting",
  "kost",
  "hoeveel",
  "angebot",
  "kostenvoranschlag",
  "schatzung",
  "kosten",
  "wie viel",
] as const;

const REPLY_WORDS = [
  "repond",
  "reponse",
  "message client",
  "ecris au client",
  "dire au client",
  "reply",
  "response",
  "client message",
  "write to the client",
  "tell the client",
  "antwoord",
  "bericht aan de klant",
  "schrijf de klant",
  "zeg tegen de klant",
  "antwort",
  "kundenantwort",
  "nachricht an den kunden",
  "schreibe dem kunden",
  "sag dem kunden",
] as const;

const AVAILABILITY_WORDS = [
  "libre",
  "disponible",
  "free",
  "available",
  "vrij",
  "beschikbaar",
  "frei",
  "verfugbar",
] as const;

const DELAY_WORDS = [
  "retard",
  "delay",
  "late",
  "vertraging",
  "te laat",
  "verspat",
  "spat",
] as const;

const ACCEPT_WORDS = [
  "disponible",
  "accepte",
  "available",
  "accept",
  "beschikbaar",
  "accepteer",
  "verfugbar",
  "akzept",
] as const;

const CLOCK =
  "(\\d{1,2})(?:\\s*(?::|h|u|uur|uhr)\\s*(\\d{1,2})?)?\\s*(am|pm)?";

const TIME_RANGE_PATTERNS: Record<ProviderAssistantLocale, readonly RegExp[]> = {
  fr: [new RegExp(`(?:de|entre)\\s+${CLOCK}\\s+(?:a|et)\\s+${CLOCK}`, "i")],
  en: [new RegExp(`(?:from|between)\\s+${CLOCK}\\s+(?:to|and)\\s+${CLOCK}`, "i")],
  nl: [new RegExp(`(?:van|tussen)\\s+${CLOCK}\\s+(?:tot|en)\\s+${CLOCK}`, "i")],
  de: [new RegExp(`(?:von|zwischen)\\s+${CLOCK}\\s+(?:bis|und)\\s+${CLOCK}`, "i")],
};

const TEXT: Record<
  ProviderAssistantLocale,
  {
    availabilityTitle: (day: string) => string;
    availabilityReply: (day: string, start: string, end: string) => string;
    quoteTitle: string;
    quoteNoRate: (hours: number) => string;
    quoteReady: (
      hours: number,
      hourlyRate: number,
      estimatedTotal: number
    ) => string;
    clientReplyTitle: string;
    clientReplyPrepared: string;
    replyDelay: string;
    replyAvailable: string;
    replyGeneric: string;
    unknownTitle: string;
    unknownReply: string;
  }
> = {
  fr: {
    availabilityTitle: (day) => `Disponibilité du ${day}`,
    availabilityReply: (day, start, end) =>
      `J’ai préparé une disponibilité pour ${day}, de ${start} à ${end}. Elle ne sera appliquée qu’après ta confirmation.`,
    quoteTitle: "Brouillon de devis",
    quoteNoRate: (hours) =>
      `J’ai compris une durée estimée de ${hours} heure(s), mais aucun tarif horaire actif n’est disponible. Ajoute d’abord ton tarif dans le Studio prestataire.`,
    quoteReady: (hours, hourlyRate, estimatedTotal) =>
      `Pour ${hours} heure(s) à ${hourlyRate} € par heure, le devis indicatif est de ${estimatedTotal} €. Vérifie toujours les détails avant de l’envoyer.`,
    clientReplyTitle: "Brouillon de réponse client",
    clientReplyPrepared:
      "J’ai préparé un message professionnel. Copie-le ou modifie-le avant de l’envoyer au client.",
    replyDelay:
      "Bonjour, merci pour votre message. Je vous informe que je risque d’avoir un léger retard. Je vous confirme l’heure exacte dès que possible.",
    replyAvailable:
      "Bonjour, merci pour votre demande. Je suis disponible pour cette prestation. Je vous propose de confirmer ensemble les derniers détails avant la réservation.",
    replyGeneric:
      "Bonjour, merci pour votre message. J’ai bien reçu votre demande et je vais vérifier les informations avant de vous confirmer ma disponibilité.",
    unknownTitle: "Demande à préciser",
    unknownReply:
      "Je peux préparer une disponibilité, un devis ou une réponse client. Exemple : « Je suis libre jeudi de 9 h à 14 h ».",
  },
  en: {
    availabilityTitle: (day) => `${day} availability`,
    availabilityReply: (day, start, end) =>
      `I prepared availability for ${day}, from ${start} to ${end}. It will only be applied after your confirmation.`,
    quoteTitle: "Quote draft",
    quoteNoRate: (hours) =>
      `I understood an estimated duration of ${hours} hour(s), but no active hourly rate is available. Add your rate in Provider Studio first.`,
    quoteReady: (hours, hourlyRate, estimatedTotal) =>
      `For ${hours} hour(s) at €${hourlyRate} per hour, the estimated quote is €${estimatedTotal}. Always check the details before sending it.`,
    clientReplyTitle: "Client reply draft",
    clientReplyPrepared:
      "I prepared a professional message. Copy or edit it before sending it to the client.",
    replyDelay:
      "Hello, thank you for your message. I may be slightly delayed. I’ll confirm the exact time as soon as possible.",
    replyAvailable:
      "Hello, thank you for your request. I’m available for this service. I suggest confirming the final details together before booking.",
    replyGeneric:
      "Hello, thank you for your message. I received your request and will check the details before confirming my availability.",
    unknownTitle: "Request needs clarification",
    unknownReply:
      "I can prepare availability, a quote, or a client reply. Example: “I am free Thursday from 9 to 14.”",
  },
  nl: {
    availabilityTitle: (day) => `Beschikbaarheid op ${day}`,
    availabilityReply: (day, start, end) =>
      `Ik heb beschikbaarheid voorbereid voor ${day}, van ${start} tot ${end}. Ze wordt pas toegepast na jouw bevestiging.`,
    quoteTitle: "Offerteconcept",
    quoteNoRate: (hours) =>
      `Ik heb een geschatte duur van ${hours} uur begrepen, maar er is geen actief uurtarief beschikbaar. Voeg eerst je tarief toe in de Provider Studio.`,
    quoteReady: (hours, hourlyRate, estimatedTotal) =>
      `Voor ${hours} uur aan €${hourlyRate} per uur is de geschatte offerte €${estimatedTotal}. Controleer altijd de details voordat je ze verstuurt.`,
    clientReplyTitle: "Conceptantwoord aan klant",
    clientReplyPrepared:
      "Ik heb een professioneel bericht voorbereid. Kopieer of bewerk het voordat je het naar de klant stuurt.",
    replyDelay:
      "Hallo, bedankt voor je bericht. Ik loop mogelijk een beetje vertraging op. Ik bevestig het exacte tijdstip zo snel mogelijk.",
    replyAvailable:
      "Hallo, bedankt voor je aanvraag. Ik ben beschikbaar voor deze dienst. Laten we de laatste details samen bevestigen vóór de boeking.",
    replyGeneric:
      "Hallo, bedankt voor je bericht. Ik heb je aanvraag ontvangen en controleer de informatie voordat ik mijn beschikbaarheid bevestig.",
    unknownTitle: "Aanvraag moet worden verduidelijkt",
    unknownReply:
      "Ik kan beschikbaarheid, een offerte of een antwoord aan een klant voorbereiden. Voorbeeld: “Ik ben donderdag vrij van 9 tot 14.”",
  },
  de: {
    availabilityTitle: (day) => `Verfügbarkeit am ${day}`,
    availabilityReply: (day, start, end) =>
      `Ich habe die Verfügbarkeit für ${day} von ${start} bis ${end} vorbereitet. Sie wird erst nach deiner Bestätigung angewendet.`,
    quoteTitle: "Angebotsentwurf",
    quoteNoRate: (hours) =>
      `Ich habe eine geschätzte Dauer von ${hours} Stunde(n) verstanden, aber es ist kein aktiver Stundensatz verfügbar. Füge zuerst deinen Tarif im Provider Studio hinzu.`,
    quoteReady: (hours, hourlyRate, estimatedTotal) =>
      `Für ${hours} Stunde(n) zu €${hourlyRate} pro Stunde beträgt das geschätzte Angebot €${estimatedTotal}. Prüfe die Details immer vor dem Senden.`,
    clientReplyTitle: "Entwurf einer Kundenantwort",
    clientReplyPrepared:
      "Ich habe eine professionelle Nachricht vorbereitet. Kopiere oder bearbeite sie, bevor du sie an den Kunden sendest.",
    replyDelay:
      "Hallo, vielen Dank für deine Nachricht. Ich könnte mich leicht verspäten. Ich bestätige die genaue Uhrzeit so bald wie möglich.",
    replyAvailable:
      "Hallo, vielen Dank für deine Anfrage. Ich bin für diesen Service verfügbar. Lass uns die letzten Details vor der Buchung gemeinsam bestätigen.",
    replyGeneric:
      "Hallo, vielen Dank für deine Nachricht. Ich habe deine Anfrage erhalten und prüfe die Angaben, bevor ich meine Verfügbarkeit bestätige.",
    unknownTitle: "Anfrage muss präzisiert werden",
    unknownReply:
      "Ich kann Verfügbarkeit, ein Angebot oder eine Kundenantwort vorbereiten. Beispiel: „Ich bin Donnerstag von 9 bis 14 Uhr frei.“",
  },
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, words: readonly string[]): boolean {
  return words.some((word) => value.includes(word));
}

function detectLocale(
  message: string,
  dayLocale?: ProviderAssistantLocale
): ProviderAssistantLocale {
  const value = normalize(message);
  const scores = Object.fromEntries(
    LOCALES.map((locale) => [locale, dayLocale === locale ? 4 : 0])
  ) as Record<ProviderAssistantLocale, number>;

  for (const locale of LOCALES) {
    for (const marker of LOCALE_MARKERS[locale]) {
      if (value.includes(marker)) scores[locale] += 1;
    }
  }

  let best: ProviderAssistantLocale = "fr";
  for (const locale of LOCALES) {
    if (scores[locale] > scores[best]) best = locale;
  }

  return best;
}

function formatTime(
  hour: number,
  minute = 0,
  meridiem?: string
): string | null {
  let resolvedHour = hour;
  const suffix = meridiem?.toLowerCase();

  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "am") resolvedHour = hour === 12 ? 0 : hour;
    if (suffix === "pm") resolvedHour = hour === 12 ? 12 : hour + 12;
  }

  if (
    resolvedHour < 0 ||
    resolvedHour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${String(resolvedHour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function detectTimes(
  message: string,
  locale: ProviderAssistantLocale
): { startTime: string; endTime: string } | null {
  const value = normalize(message);
  const orderedPatterns = [
    ...TIME_RANGE_PATTERNS[locale],
    ...LOCALES.filter((candidate) => candidate !== locale).flatMap(
      (candidate) => TIME_RANGE_PATTERNS[candidate]
    ),
  ];

  for (const pattern of orderedPatterns) {
    const range = value.match(pattern);
    if (!range) continue;

    const startTime = formatTime(
      Number(range[1]),
      Number(range[2] ?? 0),
      range[3]
    );
    const endTime = formatTime(
      Number(range[4]),
      Number(range[5] ?? 0),
      range[6]
    );

    if (startTime && endTime && endTime > startTime) {
      return { startTime, endTime };
    }
  }

  return null;
}

function detectDay(message: string): {
  dayOfWeek: number;
  label: string;
  locale: ProviderAssistantLocale;
} | null {
  const value = normalize(message);

  for (const locale of LOCALES) {
    for (const day of DAYS) {
      if (day.aliases[locale].some((alias) => value.includes(alias))) {
        return {
          dayOfWeek: day.dayOfWeek,
          label: day.labels[locale],
          locale,
        };
      }
    }
  }

  return null;
}

function detectHours(message: string): number | null {
  const value = normalize(message);
  const match = value.match(
    /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|heure|heures|u|uur|uren|std|stunde|stunden)\b/
  );

  if (!match) return null;

  const hours = Number(match[1].replace(",", "."));

  return Number.isFinite(hours) && hours > 0 && hours <= 24
    ? hours
    : null;
}

function wantsQuote(message: string): boolean {
  return includesAny(normalize(message), QUOTE_WORDS);
}

function wantsReply(message: string): boolean {
  return includesAny(normalize(message), REPLY_WORDS);
}

function wantsAvailability(message: string): boolean {
  return includesAny(normalize(message), AVAILABILITY_WORDS);
}

function buildClientReply(
  message: string,
  locale: ProviderAssistantLocale
): string {
  const value = normalize(message);
  const text = TEXT[locale];

  if (includesAny(value, DELAY_WORDS)) {
    return text.replyDelay;
  }

  if (includesAny(value, ACCEPT_WORDS)) {
    return text.replyAvailable;
  }

  return text.replyGeneric;
}

export function analyzeProviderAssistantMessage(
  message: string,
  hourlyRate: number | null
): ProviderAssistantResult {
  const day = detectDay(message);
  const locale = detectLocale(message, day?.locale);
  const times = detectTimes(message, locale);
  const text = TEXT[locale];

  if (day && times && wantsAvailability(message)) {
    const payload: AvailabilityDraft = {
      dayOfWeek: day.dayOfWeek,
      dayLabel: day.label,
      startTime: times.startTime,
      endTime: times.endTime,
    };

    return {
      intent: "availability",
      title: text.availabilityTitle(day.label),
      payload,
      requiresConfirmation: true,
      reply: text.availabilityReply(
        day.label,
        times.startTime,
        times.endTime
      ),
    };
  }

  if (wantsQuote(message)) {
    const hours = detectHours(message) ?? 1;
    const estimatedTotal =
      hourlyRate == null
        ? null
        : Math.round(hourlyRate * hours * 100) / 100;

    const payload: QuoteDraft = {
      hours,
      hourlyRate,
      estimatedTotal,
    };

    return {
      intent: "quote",
      title: text.quoteTitle,
      payload,
      requiresConfirmation: true,
      reply:
        hourlyRate == null
          ? text.quoteNoRate(hours)
          : text.quoteReady(hours, hourlyRate, estimatedTotal as number),
    };
  }

  if (wantsReply(message)) {
    const replyDraft = buildClientReply(message, locale);

    return {
      intent: "client_reply",
      title: text.clientReplyTitle,
      payload: {
        message: replyDraft,
      },
      requiresConfirmation: true,
      reply: text.clientReplyPrepared,
    };
  }

  return {
    intent: "unknown",
    title: text.unknownTitle,
    payload: {},
    requiresConfirmation: true,
    reply: text.unknownReply,
  };
}
