import type { KlyxLocale } from "@/lib/klyx-i18n";

export const KLYX_PROACTIVE_ASSISTANT_TRANSLATED_LOCALES = [
  "fr",
  "en",
  "nl",
  "de",
] as const;

export type KlyxProactiveAssistantLocale =
  (typeof KLYX_PROACTIVE_ASSISTANT_TRANSLATED_LOCALES)[number];

export const KLYX_PROACTIVE_ASSISTANT_MESSAGE_KEYS = [
  "loading",
  "loadError",
  "eyebrow",
  "emptyTitle",
  "emptyDescription",
  "title",
  "viewAll",
  "priority",
  "score",
  "whyNow",
] as const;

export type KlyxProactiveAssistantMessageKey =
  (typeof KLYX_PROACTIVE_ASSISTANT_MESSAGE_KEYS)[number];

type Dictionary = Record<KlyxProactiveAssistantMessageKey, string>;

type Explanation = {
  why: string;
  confirmation: string;
};

const DICTIONARIES: Record<KlyxProactiveAssistantLocale, Dictionary> = {
  fr: {
    loading: "KLYX analyse ce qui mérite ton attention...",
    loadError: "Les priorités KLYX sont indisponibles pour le moment.",
    eyebrow: "Assistant proactif",
    emptyTitle: "Rien d’important à faire maintenant",
    emptyDescription:
      "KLYX continue de surveiller tes prochaines étapes et fera remonter une action dès qu’elle devient utile.",
    title: "KLYX te dit quoi faire ensuite",
    viewAll: "Tout voir",
    priority: "Priorité",
    score: "Score",
    whyNow: "Pourquoi maintenant",
  },
  en: {
    loading: "KLYX is analyzing what deserves your attention...",
    loadError: "KLYX priorities are unavailable right now.",
    eyebrow: "Proactive assistant",
    emptyTitle: "Nothing important to do right now",
    emptyDescription:
      "KLYX keeps watching your next steps and will surface an action when it becomes useful.",
    title: "KLYX tells you what to do next",
    viewAll: "View all",
    priority: "Priority",
    score: "Score",
    whyNow: "Why now",
  },
  nl: {
    loading: "KLYX analyseert wat je aandacht verdient...",
    loadError: "KLYX-prioriteiten zijn momenteel niet beschikbaar.",
    eyebrow: "Proactieve assistent",
    emptyTitle: "Nu niets belangrijks te doen",
    emptyDescription:
      "KLYX blijft je volgende stappen volgen en toont een actie zodra die nuttig wordt.",
    title: "KLYX vertelt wat je hierna kunt doen",
    viewAll: "Alles bekijken",
    priority: "Prioriteit",
    score: "Score",
    whyNow: "Waarom nu",
  },
  de: {
    loading: "KLYX analysiert, was deine Aufmerksamkeit verdient...",
    loadError: "KLYX-Prioritäten sind derzeit nicht verfügbar.",
    eyebrow: "Proaktiver Assistent",
    emptyTitle: "Im Moment nichts Wichtiges zu tun",
    emptyDescription:
      "KLYX beobachtet deine nächsten Schritte weiter und zeigt eine Aktion an, sobald sie nützlich wird.",
    title: "KLYX sagt dir, was als Nächstes zu tun ist",
    viewAll: "Alle anzeigen",
    priority: "Priorität",
    score: "Score",
    whyNow: "Warum jetzt",
  },
};

const EXPLANATIONS: Record<
  KlyxProactiveAssistantLocale,
  Record<string, Explanation>
> = {
  fr: {
    compare_offers: {
      why: "Des prestataires ont répondu. Comparer maintenant évite de choisir uniquement sur le prix.",
      confirmation:
        "KLYX peut analyser et recommander, mais ne choisit aucun prestataire sans ta confirmation.",
    },
    finalize_booking: {
      why: "Le prestataire et le prix sont déjà choisis. Le créneau reste nécessaire pour créer la réservation.",
      confirmation: "La réservation n’est créée qu’après ta validation du créneau.",
    },
    payment_pending: {
      why: "La réservation existe déjà. Le paiement est la prochaine étape avant l’exécution de la mission.",
      confirmation: "KLYX ne déclenche jamais un paiement sans action explicite de ta part.",
    },
    review_completed: {
      why: "La mission est terminée. Ton avis améliore la confiance et le classement des prestataires.",
      confirmation: "L’avis reste entièrement rédigé et envoyé par toi.",
    },
    provider_offer_update: {
      why: "Une de tes offres a été acceptée. Il faut vérifier la réservation et préparer la mission.",
      confirmation:
        "KLYX peut te guider, mais aucune action contractuelle n’est exécutée automatiquement.",
    },
    default: {
      why: "KLYX a détecté cette action comme pertinente pour la suite de ton parcours.",
      confirmation: "Tu gardes toujours le contrôle des actions importantes.",
    },
  },
  en: {
    compare_offers: {
      why: "Providers have replied. Comparing now helps avoid choosing on price alone.",
      confirmation:
        "KLYX can analyze and recommend, but never chooses a provider without your confirmation.",
    },
    finalize_booking: {
      why: "The provider and price are already selected. A time slot is still required to create the booking.",
      confirmation: "The booking is created only after you confirm the time slot.",
    },
    payment_pending: {
      why: "The booking already exists. Payment is the next step before the mission can be carried out.",
      confirmation: "KLYX never triggers a payment without an explicit action from you.",
    },
    review_completed: {
      why: "The mission is complete. Your review improves provider trust and ranking.",
      confirmation: "The review is always written and submitted entirely by you.",
    },
    provider_offer_update: {
      why: "One of your offers was accepted. The booking should be checked and the mission prepared.",
      confirmation:
        "KLYX can guide you, but no contractual action is executed automatically.",
    },
    default: {
      why: "KLYX detected this action as relevant to the next step in your journey.",
      confirmation: "You always stay in control of important actions.",
    },
  },
  nl: {
    compare_offers: {
      why: "Dienstverleners hebben geantwoord. Nu vergelijken voorkomt dat je alleen op prijs kiest.",
      confirmation:
        "KLYX kan analyseren en aanbevelen, maar kiest nooit een dienstverlener zonder jouw bevestiging.",
    },
    finalize_booking: {
      why: "De dienstverlener en prijs zijn al gekozen. Een tijdslot is nog nodig om de boeking aan te maken.",
      confirmation: "De boeking wordt alleen aangemaakt nadat jij het tijdslot bevestigt.",
    },
    payment_pending: {
      why: "De boeking bestaat al. Betaling is de volgende stap vóór de uitvoering van de missie.",
      confirmation: "KLYX start nooit een betaling zonder een expliciete actie van jou.",
    },
    review_completed: {
      why: "De missie is voltooid. Je beoordeling verbetert het vertrouwen en de rangschikking van dienstverleners.",
      confirmation: "De beoordeling wordt volledig door jou geschreven en verzonden.",
    },
    provider_offer_update: {
      why: "Een van je offertes is geaccepteerd. Controleer de boeking en bereid de missie voor.",
      confirmation:
        "KLYX kan je begeleiden, maar voert geen contractuele actie automatisch uit.",
    },
    default: {
      why: "KLYX heeft deze actie als relevant voor de volgende stap in je traject gedetecteerd.",
      confirmation: "Je behoudt altijd de controle over belangrijke acties.",
    },
  },
  de: {
    compare_offers: {
      why: "Anbieter haben geantwortet. Ein Vergleich verhindert, dass du nur nach dem Preis entscheidest.",
      confirmation:
        "KLYX kann analysieren und empfehlen, wählt aber keinen Anbieter ohne deine Bestätigung.",
    },
    finalize_booking: {
      why: "Anbieter und Preis sind bereits ausgewählt. Für die Buchung fehlt noch ein Zeitfenster.",
      confirmation: "Die Buchung wird erst nach deiner Bestätigung des Zeitfensters erstellt.",
    },
    payment_pending: {
      why: "Die Buchung besteht bereits. Die Zahlung ist der nächste Schritt vor der Durchführung der Mission.",
      confirmation: "KLYX löst niemals eine Zahlung ohne eine ausdrückliche Aktion von dir aus.",
    },
    review_completed: {
      why: "Die Mission ist abgeschlossen. Deine Bewertung verbessert Vertrauen und Ranking der Anbieter.",
      confirmation: "Die Bewertung wird vollständig von dir verfasst und abgesendet.",
    },
    provider_offer_update: {
      why: "Eines deiner Angebote wurde angenommen. Prüfe die Buchung und bereite die Mission vor.",
      confirmation:
        "KLYX kann dich führen, führt aber keine vertragliche Aktion automatisch aus.",
    },
    default: {
      why: "KLYX hat diese Aktion als relevant für den nächsten Schritt erkannt.",
      confirmation: "Du behältst bei wichtigen Aktionen immer die Kontrolle.",
    },
  },
};

export function resolveKlyxProactiveAssistantLocale(
  locale: KlyxLocale | string
): KlyxProactiveAssistantLocale {
  return KLYX_PROACTIVE_ASSISTANT_TRANSLATED_LOCALES.includes(
    locale as KlyxProactiveAssistantLocale
  )
    ? (locale as KlyxProactiveAssistantLocale)
    : "fr";
}

export function getKlyxProactiveAssistantDictionary(
  locale: KlyxLocale | string
): Dictionary {
  return DICTIONARIES[resolveKlyxProactiveAssistantLocale(locale)];
}

export function translateKlyxProactiveAssistant(
  locale: KlyxLocale | string,
  key: KlyxProactiveAssistantMessageKey
): string {
  return getKlyxProactiveAssistantDictionary(locale)[key];
}

export function explainKlyxProactiveAction(
  locale: KlyxLocale | string,
  kind: string
): Explanation {
  const resolved = resolveKlyxProactiveAssistantLocale(locale);
  return EXPLANATIONS[resolved][kind] ?? EXPLANATIONS[resolved].default;
}
