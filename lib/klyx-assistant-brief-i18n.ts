import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_ASSISTANT_BRIEF_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxAssistantBriefLocale =
  (typeof KLYX_ASSISTANT_BRIEF_TRANSLATED_LOCALES)[number];

export const KLYX_ASSISTANT_BRIEF_MESSAGE_KEYS = [
  "loading",
  "eyebrow",
  "upToDate",
  "providerNoPriority",
  "clientNoPriority",
  "providerFallbackCta",
  "clientFallbackCta",
] as const;

export type KlyxAssistantBriefMessageKey =
  (typeof KLYX_ASSISTANT_BRIEF_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxAssistantBriefMessageKey, string>;

const DICTIONARIES: Record<KlyxAssistantBriefLocale, Dictionary> = {
  fr: {
    loading: "Préparation de ton brief...",
    eyebrow: "Brief KLYX",
    upToDate: "À jour",
    providerNoPriority: "Ton activité est à jour. KLYX n’a détecté aucune action prioritaire.",
    clientNoPriority: "Tout est à jour. KLYX n’a détecté aucune action prioritaire.",
    providerFallbackCta: "Voir les missions",
    clientFallbackCta: "Nouveau besoin",
  },
  en: {
    loading: "Preparing your brief...",
    eyebrow: "KLYX Brief",
    upToDate: "Up to date",
    providerNoPriority: "Your activity is up to date. KLYX detected no priority action.",
    clientNoPriority: "Everything is up to date. KLYX detected no priority action.",
    providerFallbackCta: "View missions",
    clientFallbackCta: "New need",
  },
  nl: {
    loading: "Je briefing wordt voorbereid...",
    eyebrow: "KLYX-briefing",
    upToDate: "Up-to-date",
    providerNoPriority: "Je activiteit is up-to-date. KLYX detecteerde geen prioritaire actie.",
    clientNoPriority: "Alles is up-to-date. KLYX detecteerde geen prioritaire actie.",
    providerFallbackCta: "Missies bekijken",
    clientFallbackCta: "Nieuwe behoefte",
  },
  de: {
    loading: "Dein Briefing wird vorbereitet...",
    eyebrow: "KLYX-Briefing",
    upToDate: "Aktuell",
    providerNoPriority: "Deine Aktivität ist aktuell. KLYX hat keine prioritäre Aktion erkannt.",
    clientNoPriority: "Alles ist aktuell. KLYX hat keine prioritäre Aktion erkannt.",
    providerFallbackCta: "Missionen ansehen",
    clientFallbackCta: "Neuer Bedarf",
  },
};

export function resolveKlyxAssistantBriefLocale(
  locale: KlyxLocale | string
): KlyxAssistantBriefLocale {
  return KLYX_ASSISTANT_BRIEF_TRANSLATED_LOCALES.includes(
    locale as KlyxAssistantBriefLocale
  )
    ? (locale as KlyxAssistantBriefLocale)
    : "fr";
}

export function getKlyxAssistantBriefDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxAssistantBriefLocale(locale)];
}

export function translateKlyxAssistantBrief(
  locale: KlyxLocale | string,
  key: KlyxAssistantBriefMessageKey
): string {
  return getKlyxAssistantBriefDictionary(locale)[key];
}

export function formatKlyxAssistantBriefUrgentCount(
  locale: KlyxLocale | string,
  count: number
): string {
  const resolved = resolveKlyxAssistantBriefLocale(locale);

  if (resolved === "en") {
    return `${count} urgent`;
  }

  if (resolved === "nl") {
    return `${count} dringend`;
  }

  if (resolved === "de") {
    return `${count} dringend`;
  }

  return `${count} urgente${count > 1 ? "s" : ""}`;
}

export function formatKlyxAssistantBriefText(
  locale: KlyxLocale | string,
  accountType: "client" | "provider",
  firstTitle: string | null,
  remaining: number
): string {
  const resolved = resolveKlyxAssistantBriefLocale(locale);
  const dictionary = DICTIONARIES[resolved];

  if (!firstTitle) {
    return accountType === "provider"
      ? dictionary.providerNoPriority
      : dictionary.clientNoPriority;
  }

  if (remaining <= 0) {
    if (resolved === "en") return `Your current priority: ${firstTitle}.`;
    if (resolved === "nl") return `Je huidige prioriteit: ${firstTitle}.`;
    if (resolved === "de") return `Deine aktuelle Priorität: ${firstTitle}.`;
    return `Ta priorité actuelle : ${firstTitle}.`;
  }

  if (resolved === "en") {
    return `Your current priority: ${firstTitle}. ${remaining} other ${remaining === 1 ? "action also deserves" : "actions also deserve"} your attention.`;
  }

  if (resolved === "nl") {
    return `Je huidige prioriteit: ${firstTitle}. ${remaining} andere ${remaining === 1 ? "actie verdient" : "acties verdienen"} ook je aandacht.`;
  }

  if (resolved === "de") {
    return `Deine aktuelle Priorität: ${firstTitle}. ${remaining} weitere ${remaining === 1 ? "Aktion verdient" : "Aktionen verdienen"} ebenfalls deine Aufmerksamkeit.`;
  }

  return `Ta priorité actuelle : ${firstTitle}. ${remaining} autre${
    remaining > 1 ? "s" : ""
  } action${remaining > 1 ? "s" : ""} mérite${
    remaining > 1 ? "nt" : ""
  } aussi ton attention.`;
}
