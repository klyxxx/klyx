import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_PROVIDER_ASSISTANT_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProviderAssistantLocale =
  (typeof KLYX_PROVIDER_ASSISTANT_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_ASSISTANT_MESSAGE_KEYS = [
  "badge",
  "title",
  "prepareQuestion",
  "surfaceDescription",
  "conversationLabel",
  "conversationIntro",
  "preparing",
  "missionContextTitle",
  "missionContextDescription",
  "placeholder",
  "prepare",
  "copyReply",
  "inspectMissions",
  "historyEyebrow",
  "draftsTitle",
  "draftReady",
  "noDrafts",
  "apply",
  "discard",
  "backToActivity",
  "controlNote",
  "loadError",
  "submitError",
  "actionError",
  "copied",
  "availabilityApplied",
  "draftDiscarded",
] as const;

export type KlyxProviderAssistantMessageKey =
  (typeof KLYX_PROVIDER_ASSISTANT_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProviderAssistantMessageKey, string>;

const DICTIONARIES: Record<KlyxProviderAssistantLocale, Dictionary> = {
  fr: {
    badge: "Assistant KLYX",
    title: "Assistant prestataire",
    prepareQuestion: "Que dois-je préparer pour ton activité ?",
    surfaceDescription:
      "Réponse client, devis, disponibilité ou recherche de missions compatibles. Rien n’est appliqué, envoyé ou accepté sans ta confirmation.",
    conversationLabel: "Conversation avec KLYX",
    conversationIntro:
      "Dis-moi simplement ce que tu veux préparer ou l’objectif que tu veux viser. Je vérifie les données KLYX avant ta décision.",
    preparing: "KLYX prépare une réponse",
    missionContextTitle: "Contexte de mission chargé",
    missionContextDescription: "Contexte prêt. Modifie puis prépare.",
    placeholder: "Demander à KLYX…",
    prepare: "Préparer",
    copyReply: "Copier la réponse",
    inspectMissions: "Voir les missions",
    historyEyebrow: "Historique professionnel",
    draftsTitle: "Brouillons à vérifier",
    draftReady: "Brouillon prêt à vérifier.",
    noDrafts: "Aucun brouillon",
    apply: "Appliquer",
    discard: "Supprimer le brouillon",
    backToActivity: "Retour à mon activité",
    controlNote: "KLYX prépare. Tu confirmes toujours avant toute action.",
    loadError: "Impossible de charger les brouillons pour le moment.",
    submitError: "Impossible de préparer cette demande pour le moment.",
    actionError: "Impossible de traiter ce brouillon pour le moment.",
    copied: "Texte copié.",
    availabilityApplied: "Disponibilité appliquée.",
    draftDiscarded: "Brouillon supprimé.",
  },
  en: {
    badge: "KLYX assistant",
    title: "Provider assistant",
    prepareQuestion: "What should I prepare for your activity?",
    surfaceDescription:
      "Client reply, quote, availability or compatible job search. Nothing is applied, sent or accepted without your confirmation.",
    conversationLabel: "Conversation with KLYX",
    conversationIntro:
      "Tell me what you want to prepare or the target you want to reach. I’ll check KLYX data before you decide.",
    preparing: "KLYX is preparing a reply",
    missionContextTitle: "Job context loaded",
    missionContextDescription: "Context is ready. Edit it, then prepare the draft.",
    placeholder: "Ask KLYX…",
    prepare: "Prepare",
    copyReply: "Copy reply",
    inspectMissions: "View jobs",
    historyEyebrow: "Professional history",
    draftsTitle: "Drafts to review",
    draftReady: "Draft ready to review.",
    noDrafts: "No drafts",
    apply: "Apply",
    discard: "Discard draft",
    backToActivity: "Back to my activity",
    controlNote: "KLYX prepares. You always confirm before any action.",
    loadError: "KLYX cannot load your drafts right now.",
    submitError: "KLYX cannot prepare this request right now.",
    actionError: "KLYX cannot process this draft right now.",
    copied: "Text copied.",
    availabilityApplied: "Availability applied.",
    draftDiscarded: "Draft discarded.",
  },
  nl: {
    badge: "KLYX-assistent",
    title: "Assistent voor dienstverleners",
    prepareQuestion: "Wat moet ik voor je activiteit voorbereiden?",
    surfaceDescription:
      "Klantantwoord, offerte, beschikbaarheid of zoeken naar compatibele opdrachten. Niets wordt toegepast, verzonden of geaccepteerd zonder jouw bevestiging.",
    conversationLabel: "Gesprek met KLYX",
    conversationIntro:
      "Vertel wat je wilt voorbereiden of welk doel je wilt bereiken. Ik controleer KLYX-gegevens voordat jij beslist.",
    preparing: "KLYX bereidt een antwoord voor",
    missionContextTitle: "Opdrachtcontext geladen",
    missionContextDescription:
      "De context is klaar. Pas hem aan en maak daarna het concept.",
    placeholder: "Vraag KLYX…",
    prepare: "Voorbereiden",
    copyReply: "Antwoord kopiëren",
    inspectMissions: "Opdrachten bekijken",
    historyEyebrow: "Professionele geschiedenis",
    draftsTitle: "Concepten om te controleren",
    draftReady: "Concept klaar om te controleren.",
    noDrafts: "Geen concepten",
    apply: "Toepassen",
    discard: "Concept verwijderen",
    backToActivity: "Terug naar mijn activiteit",
    controlNote: "KLYX bereidt voor. Jij bevestigt altijd vóór elke actie.",
    loadError: "KLYX kan je concepten momenteel niet laden.",
    submitError: "KLYX kan deze aanvraag momenteel niet voorbereiden.",
    actionError: "KLYX kan dit concept momenteel niet verwerken.",
    copied: "Tekst gekopieerd.",
    availabilityApplied: "Beschikbaarheid toegepast.",
    draftDiscarded: "Concept verwijderd.",
  },
  de: {
    badge: "KLYX-Assistent",
    title: "Anbieterassistent",
    prepareQuestion: "Was soll ich für deine Tätigkeit vorbereiten?",
    surfaceDescription:
      "Kundenantwort, Angebot, Verfügbarkeit oder Suche nach kompatiblen Aufträgen. Nichts wird ohne deine Bestätigung angewendet, gesendet oder angenommen.",
    conversationLabel: "Gespräch mit KLYX",
    conversationIntro:
      "Sag mir, was du vorbereiten möchtest oder welches Ziel du erreichen willst. Ich prüfe die KLYX-Daten, bevor du entscheidest.",
    preparing: "KLYX bereitet eine Antwort vor",
    missionContextTitle: "Auftragskontext geladen",
    missionContextDescription:
      "Der Kontext ist bereit. Bearbeite ihn und erstelle dann den Entwurf.",
    placeholder: "KLYX fragen…",
    prepare: "Vorbereiten",
    copyReply: "Antwort kopieren",
    inspectMissions: "Aufträge ansehen",
    historyEyebrow: "Beruflicher Verlauf",
    draftsTitle: "Entwürfe zur Prüfung",
    draftReady: "Entwurf ist zur Prüfung bereit.",
    noDrafts: "Keine Entwürfe",
    apply: "Anwenden",
    discard: "Entwurf verwerfen",
    backToActivity: "Zurück zu meiner Tätigkeit",
    controlNote: "KLYX bereitet vor. Du bestätigst immer vor jeder Aktion.",
    loadError: "KLYX kann deine Entwürfe derzeit nicht laden.",
    submitError: "KLYX kann diese Anfrage derzeit nicht vorbereiten.",
    actionError: "KLYX kann diesen Entwurf derzeit nicht verarbeiten.",
    copied: "Text kopiert.",
    availabilityApplied: "Verfügbarkeit angewendet.",
    draftDiscarded: "Entwurf verworfen.",
  },
};

const EXAMPLES: Record<KlyxProviderAssistantLocale, readonly string[]> = {
  fr: [
    "Je suis libre jeudi de 9 h à 14 h.",
    "Prépare un devis pour 3 heures.",
    "Réponds au client que je suis disponible.",
    "Je suis libre samedi, je veux gagner environ 100 €, trouve-moi des missions près de chez moi.",
  ],
  en: [
    "I am available Thursday from 9 AM to 2 PM.",
    "Prepare a quote for 3 hours.",
    "Reply to the client that I am available.",
    "I am free Saturday and want to earn about €100. Find jobs near me.",
  ],
  nl: [
    "Ik ben donderdag beschikbaar van 09:00 tot 14:00.",
    "Maak een offerte voor 3 uur.",
    "Antwoord de klant dat ik beschikbaar ben.",
    "Ik ben zaterdag vrij en wil ongeveer €100 verdienen. Vind opdrachten bij mij in de buurt.",
  ],
  de: [
    "Ich bin Donnerstag von 09:00 bis 14:00 verfügbar.",
    "Erstelle ein Angebot für 3 Stunden.",
    "Antworte dem Kunden, dass ich verfügbar bin.",
    "Ich bin Samstag frei und möchte ungefähr 100 € verdienen. Finde Aufträge in meiner Nähe.",
  ],
};

const STATUS_LABELS: Record<
  KlyxProviderAssistantLocale,
  Record<string, string>
> = {
  fr: {
    draft: "Brouillon",
    applied: "Appliqué",
    discarded: "Supprimé",
  },
  en: {
    draft: "Draft",
    applied: "Applied",
    discarded: "Discarded",
  },
  nl: {
    draft: "Concept",
    applied: "Toegepast",
    discarded: "Verwijderd",
  },
  de: {
    draft: "Entwurf",
    applied: "Angewendet",
    discarded: "Verworfen",
  },
};

const INTL_LOCALES: Record<KlyxProviderAssistantLocale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
};

export function resolveKlyxProviderAssistantLocale(
  locale: KlyxLocale | string
): KlyxProviderAssistantLocale {
  return KLYX_PROVIDER_ASSISTANT_TRANSLATED_LOCALES.includes(
    locale as KlyxProviderAssistantLocale
  )
    ? (locale as KlyxProviderAssistantLocale)
    : "fr";
}

export function getKlyxProviderAssistantDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxProviderAssistantLocale(locale)];
}

export function translateKlyxProviderAssistant(
  locale: KlyxLocale | string,
  key: KlyxProviderAssistantMessageKey
): string {
  return getKlyxProviderAssistantDictionary(locale)[key];
}

export function getKlyxProviderAssistantExamples(
  locale: KlyxLocale | string
): readonly string[] {
  return EXAMPLES[resolveKlyxProviderAssistantLocale(locale)];
}

export function getKlyxProviderAssistantIntlLocale(
  locale: KlyxLocale | string
): string {
  return INTL_LOCALES[resolveKlyxProviderAssistantLocale(locale)];
}

export function translateKlyxProviderAssistantStatus(
  locale: KlyxLocale | string,
  status: string
): string {
  const resolved = resolveKlyxProviderAssistantLocale(locale);
  return STATUS_LABELS[resolved][status] ?? status;
}
