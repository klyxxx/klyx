export type AssistantLocale = "fr" | "en" | "nl" | "de";

export type AssistantGroundedAction = {
  id: string;
  kind: string;
  href: string;
  label: string;
};

export type DeterministicHelp = {
  reply: string;
  topic: string;
  action?: AssistantGroundedAction;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAssistantLocale(locale: string | null | undefined): AssistantLocale {
  return locale === "en" || locale === "nl" || locale === "de" ? locale : "fr";
}

export function detectRequestedAssistantLocale(message: string): AssistantLocale | null {
  const value = normalize(message);

  if (/\b(?:francais|french|frans|franzosisch)\b/.test(value)) return "fr";
  if (/\b(?:anglais|english|engels|englisch)\b/.test(value)) return "en";
  if (/\b(?:neerlandais|nederlands|dutch|hollandais)\b/.test(value)) return "nl";
  if (/\b(?:allemand|deutsch|german|duits)\b/.test(value)) return "de";

  return null;
}

function localized(
  locale: AssistantLocale,
  values: Record<AssistantLocale, string>
): string {
  return values[locale];
}

export function accountHelp(message: string, rawLocale: string): DeterministicHelp {
  const locale = normalizeAssistantLocale(rawLocale);
  const value = normalize(message);
  const accountSwitch = /\b(?:profil|profile|compte|account|wissel|wechsel).*(?:changer|switch|wissel|wechsel)|(?:changer|switch).*(?:profil|profile|compte|account)\b/.test(value);
  const settings = /\b(?:parametre|settings|instellingen|einstellungen|notification|privacy|confidentialite)\b/.test(value);

  if (accountSwitch) {
    return {
      topic: "account_switching",
      reply: localized(locale, {
        fr: "Tu peux gérer les profils liés à ton compte KLYX et changer de profil sans nouvelle connexion.",
        en: "You can manage the profiles linked to your KLYX account and switch profile without signing in again.",
        nl: "Je kunt de profielen van je KLYX-account beheren en van profiel wisselen zonder opnieuw in te loggen.",
        de: "Du kannst die mit deinem KLYX-Konto verknüpften Profile verwalten und ohne erneute Anmeldung wechseln.",
      }),
      action: {
        id: "open-accounts",
        kind: "account_profiles",
        href: "/accounts",
        label: localized(locale, {
          fr: "Gérer mes profils",
          en: "Manage profiles",
          nl: "Profielen beheren",
          de: "Profile verwalten",
        }),
      },
    };
  }

  return {
    topic: settings ? "account_settings" : "profile_help",
    reply: localized(locale, {
      fr: settings
        ? "Je peux t’aider à retrouver les réglages de ton compte. Les changements sensibles restent confirmés dans l’écran concerné."
        : "Je peux t’aider avec ton profil KLYX, tes informations de compte et tes capacités client ou prestataire.",
      en: settings
        ? "I can help you find your account settings. Sensitive changes still require confirmation on the relevant screen."
        : "I can help with your KLYX profile, account information, and client or provider capabilities.",
      nl: settings
        ? "Ik kan je helpen je accountinstellingen te vinden. Gevoelige wijzigingen moeten nog op het juiste scherm worden bevestigd."
        : "Ik kan helpen met je KLYX-profiel, accountgegevens en klant- of dienstverlenersmogelijkheden.",
      de: settings
        ? "Ich kann dir helfen, deine Kontoeinstellungen zu finden. Sensible Änderungen müssen weiterhin im entsprechenden Bereich bestätigt werden."
        : "Ich kann dir bei deinem KLYX-Profil, deinen Kontodaten und deinen Kunden- oder Anbieterfunktionen helfen.",
    }),
    action: {
      id: settings ? "open-settings" : "open-profile",
      kind: settings ? "account_settings" : "profile",
      href: settings ? "/settings" : "/profile",
      label: localized(locale, {
        fr: settings ? "Ouvrir les paramètres" : "Ouvrir mon profil",
        en: settings ? "Open settings" : "Open my profile",
        nl: settings ? "Instellingen openen" : "Mijn profiel openen",
        de: settings ? "Einstellungen öffnen" : "Mein Profil öffnen",
      }),
    },
  };
}

export function providerHelp(rawLocale: string): DeterministicHelp {
  const locale = normalizeAssistantLocale(rawLocale);
  return {
    topic: "provider_help",
    reply: localized(locale, {
      fr: "Je peux t’aider à configurer tes services, zones, disponibilités et tarifs, puis chercher des missions compatibles. L’éligibilité et les paiements restent décidés par les moteurs KLYX côté serveur.",
      en: "I can help configure your services, areas, availability and pricing, then find compatible jobs. Eligibility and payouts remain server-side KLYX decisions.",
      nl: "Ik kan je helpen je diensten, zones, beschikbaarheid en tarieven in te stellen en daarna passende opdrachten te zoeken. Geschiktheid en uitbetalingen blijven serverbeslissingen van KLYX.",
      de: "Ich kann dir helfen, Leistungen, Gebiete, Verfügbarkeit und Preise einzurichten und danach passende Aufträge zu finden. Eignung und Auszahlungen bleiben serverseitige KLYX-Entscheidungen.",
    }),
    action: {
      id: "open-provider",
      kind: "provider_hub",
      href: "/provider",
      label: localized(locale, {
        fr: "Ouvrir mon espace prestataire",
        en: "Open provider area",
        nl: "Dienstverlenersruimte openen",
        de: "Anbieterbereich öffnen",
      }),
    },
  };
}

export function languageChangeReply(locale: AssistantLocale): string {
  return localized(locale, {
    fr: "La langue de KLYX est maintenant réglée sur le français.",
    en: "KLYX is now set to English.",
    nl: "KLYX is nu ingesteld op Nederlands.",
    de: "KLYX ist jetzt auf Deutsch eingestellt.",
  });
}

export function deterministicInformation(
  message: string,
  rawLocale: string
): DeterministicHelp | null {
  const locale = normalizeAssistantLocale(rawLocale);
  const value = normalize(message);

  if (/\b(?:comment fonctionne|what is klyx|how does klyx work|wat is klyx|hoe werkt klyx|was ist klyx|wie funktioniert klyx|c est quoi klyx|qu est ce que klyx)\b/.test(value)) {
    return {
      topic: "klyx_overview",
      reply: localized(locale, {
        fr: "KLYX est un assistant qui organise les services du quotidien : il comprend ton besoin, cherche des options, prépare la réservation et suit la mission. Les paiements, le KYC, l’éligibilité, les remboursements et le settlement restent contrôlés par des moteurs déterministes côté serveur.",
        en: "KLYX is an assistant that organizes everyday services: it understands your need, finds options, prepares the booking and follows the mission. Payments, KYC, eligibility, refunds and settlement remain controlled by deterministic server-side engines.",
        nl: "KLYX is een assistent die dagelijkse diensten organiseert: hij begrijpt je behoefte, zoekt opties, bereidt de boeking voor en volgt de opdracht. Betalingen, KYC, geschiktheid, terugbetalingen en settlement blijven onder controle van deterministische servermotoren.",
        de: "KLYX ist ein Assistent für Alltagsdienstleistungen: Er versteht deinen Bedarf, sucht Optionen, bereitet die Buchung vor und begleitet den Auftrag. Zahlungen, KYC, Eignung, Rückerstattungen und Settlement bleiben unter Kontrolle deterministischer Server-Engines.",
      }),
    };
  }

  if (/\b(?:gratuit|free|kostenlos|gratis|prix de klyx|cout de klyx|cost of klyx)\b/.test(value)) {
    return {
      topic: "klyx_access",
      reply: localized(locale, {
        fr: "L’accès au compte KLYX peut être gratuit. Les montants liés à une prestation, aux frais ou à une commission sont affichés par le moteur de paiement avant toute confirmation concernée.",
        en: "Access to a KLYX account can be free. Service amounts, fees or commissions are shown by the payment engine before the relevant confirmation.",
        nl: "Toegang tot een KLYX-account kan gratis zijn. Bedragen voor diensten, kosten of commissies worden door de betaalmotor getoond vóór de betreffende bevestiging.",
        de: "Der Zugang zu einem KLYX-Konto kann kostenlos sein. Beträge für Dienstleistungen, Gebühren oder Provisionen werden vor der jeweiligen Bestätigung durch die Zahlungs-Engine angezeigt.",
      }),
    };
  }

  if (/\b(?:securite|security|veiligheid|sicherheit|confiance|trust)\b/.test(value)) {
    return {
      topic: "klyx_safety",
      reply: localized(locale, {
        fr: "KLYX sépare l’assistant conversationnel des autorités sensibles. Le LLM peut expliquer et organiser, mais les décisions financières, KYC, eligibility, settlement et refund restent déterministes, auditées et côté serveur.",
        en: "KLYX separates the conversational assistant from sensitive authorities. The LLM can explain and organize, but financial, KYC, eligibility, settlement and refund decisions remain deterministic, audited and server-side.",
        nl: "KLYX scheidt de conversatie-assistent van gevoelige autoriteiten. Het LLM kan uitleggen en organiseren, maar financiële, KYC-, geschiktheids-, settlement- en terugbetalingsbeslissingen blijven deterministisch, gecontroleerd en server-side.",
        de: "KLYX trennt den Gesprächsassistenten von sensiblen Entscheidungsinstanzen. Das LLM kann erklären und organisieren, aber Finanz-, KYC-, Eignungs-, Settlement- und Rückerstattungsentscheidungen bleiben deterministisch, auditiert und serverseitig.",
      }),
    };
  }

  return null;
}
