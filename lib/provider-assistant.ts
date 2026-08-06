export type ProviderAssistantIntent =
  | "availability"
  | "quote"
  | "client_reply"
  | "unknown";

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

const DAYS = [
  { dayOfWeek: 1, label: "lundi", aliases: ["lundi"] },
  { dayOfWeek: 2, label: "mardi", aliases: ["mardi"] },
  { dayOfWeek: 3, label: "mercredi", aliases: ["mercredi"] },
  { dayOfWeek: 4, label: "jeudi", aliases: ["jeudi"] },
  { dayOfWeek: 5, label: "vendredi", aliases: ["vendredi"] },
  { dayOfWeek: 6, label: "samedi", aliases: ["samedi"] },
  { dayOfWeek: 0, label: "dimanche", aliases: ["dimanche"] },
] as const;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(hour: number, minute = 0): string | null {
  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(
    minute
  ).padStart(2, "0")}`;
}

function detectTimes(
  message: string
): { startTime: string; endTime: string } | null {
  const value = normalize(message);

  const range = value.match(
    /(?:de|entre)\s+(\d{1,2})(?:\s*(?:h|:)\s*(\d{1,2}))?\s+(?:a|et)\s+(\d{1,2})(?:\s*(?:h|:)\s*(\d{1,2}))?/
  );

  if (!range) return null;

  const startTime = formatTime(
    Number(range[1]),
    Number(range[2] ?? 0)
  );
  const endTime = formatTime(
    Number(range[3]),
    Number(range[4] ?? 0)
  );

  if (!startTime || !endTime || endTime <= startTime) {
    return null;
  }

  return { startTime, endTime };
}

function detectDay(
  message: string
): (typeof DAYS)[number] | null {
  const value = normalize(message);

  return (
    DAYS.find((day) =>
      day.aliases.some((alias) => value.includes(alias))
    ) ?? null
  );
}

function detectHours(message: string): number | null {
  const value = normalize(message);

  const match = value.match(
    /(\d+(?:[.,]\d+)?)\s*(?:h|heure|heures)\b/
  );

  if (!match) return null;

  const hours = Number(match[1].replace(",", "."));

  return Number.isFinite(hours) && hours > 0 && hours <= 24
    ? hours
    : null;
}

function wantsQuote(message: string): boolean {
  const value = normalize(message);

  return [
    "devis",
    "combien",
    "estimation",
    "prix",
    "tarif",
  ].some((word) => value.includes(word));
}

function wantsReply(message: string): boolean {
  const value = normalize(message);

  return [
    "repond",
    "reponse",
    "message client",
    "ecris au client",
    "dire au client",
  ].some((word) => value.includes(word));
}

function buildClientReply(message: string): string {
  const value = normalize(message);

  if (value.includes("retard")) {
    return "Bonjour, merci pour votre message. Je vous informe que je risque d’avoir un léger retard. Je vous confirme l’heure exacte dès que possible.";
  }

  if (
    value.includes("disponible") ||
    value.includes("accepte")
  ) {
    return "Bonjour, merci pour votre demande. Je suis disponible pour cette prestation. Je vous propose de confirmer ensemble les derniers détails avant la réservation.";
  }

  return "Bonjour, merci pour votre message. J’ai bien reçu votre demande et je vais vérifier les informations avant de vous confirmer ma disponibilité.";
}

export function analyzeProviderAssistantMessage(
  message: string,
  hourlyRate: number | null
): ProviderAssistantResult {
  const day = detectDay(message);
  const times = detectTimes(message);

  if (
    day &&
    times &&
    normalize(message).includes("libre")
  ) {
    const payload: AvailabilityDraft = {
      dayOfWeek: day.dayOfWeek,
      dayLabel: day.label,
      startTime: times.startTime,
      endTime: times.endTime,
    };

    return {
      intent: "availability",
      title: `Disponibilité du ${day.label}`,
      payload,
      requiresConfirmation: true,
      reply:
        `J’ai préparé une disponibilité pour ${day.label}, ` +
        `de ${times.startTime} à ${times.endTime}. ` +
        "Elle ne sera appliquée qu’après ta confirmation.",
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
      title: "Brouillon de devis",
      payload,
      requiresConfirmation: true,
      reply:
        hourlyRate == null
          ? `J’ai compris une durée estimée de ${hours} heure(s), mais aucun tarif horaire actif n’est disponible. Ajoute d’abord ton tarif dans le Studio prestataire.`
          : `Pour ${hours} heure(s) à ${hourlyRate} € par heure, le devis indicatif est de ${estimatedTotal} €. Vérifie toujours les détails avant de l’envoyer.`,
    };
  }

  if (wantsReply(message)) {
    const replyDraft = buildClientReply(message);

    return {
      intent: "client_reply",
      title: "Brouillon de réponse client",
      payload: {
        message: replyDraft,
      },
      requiresConfirmation: true,
      reply:
        "J’ai préparé un message professionnel. Copie-le ou modifie-le avant de l’envoyer au client.",
    };
  }

  return {
    intent: "unknown",
    title: "Demande à préciser",
    payload: {},
    requiresConfirmation: true,
    reply:
      "Je peux préparer une disponibilité, un devis ou une réponse client. Exemple : « Je suis libre jeudi de 9 h à 14 h ».",
  };
}
