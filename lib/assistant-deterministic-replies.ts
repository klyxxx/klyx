import type { KlyxAssistantCapability } from "@/lib/assistant-capability-router";

type SupportedLocale = "fr" | "en" | "nl" | "de";

type AccountContext = {
  firstName?: string;
  canRequestServices?: boolean;
  canOfferServices?: boolean;
};

export type KlyxDeterministicAssistantReply = {
  reply: string;
  action: { href: string; label: string } | null;
};

function localeOf(value: string | null | undefined): SupportedLocale {
  return value === "en" || value === "nl" || value === "de" ? value : "fr";
}

function klyxInformation(locale: SupportedLocale): KlyxDeterministicAssistantReply {
  if (locale === "en") {
    return {
      reply:
        "KLYX is one assistant for everyday services. It can understand a need, search and match providers, prepare a request, guide booking and payment, follow a mission, and help providers. Sensitive decisions stay with deterministic KLYX engines: the assistant never decides payment, KYC, eligibility, settlement or refunds by itself.",
      action: null,
    };
  }
  if (locale === "nl") {
    return {
      reply:
        "KLYX is één assistent voor dagelijkse diensten. Het kan je behoefte begrijpen, dienstverleners zoeken en matchen, een aanvraag voorbereiden, reservering en betaling begeleiden, een opdracht volgen en dienstverleners helpen. Gevoelige beslissingen blijven bij de deterministische KLYX-motoren: de assistent beslist nooit zelf over betaling, KYC, eligibility, settlement of terugbetaling.",
      action: null,
    };
  }
  if (locale === "de") {
    return {
      reply:
        "KLYX ist ein einziger Assistent für alltägliche Dienstleistungen. Er kann Bedarf verstehen, Anbieter suchen und matchen, Anfragen vorbereiten, Buchung und Zahlung begleiten, Aufträge verfolgen und Anbieter unterstützen. Sensible Entscheidungen bleiben bei deterministischen KLYX-Engines: Der Assistent entscheidet nie selbst über Zahlung, KYC, Eligibility, Settlement oder Erstattung.",
      action: null,
    };
  }
  return {
    reply:
      "KLYX est un assistant unique pour les services du quotidien. Il peut comprendre un besoin, rechercher et matcher des prestataires, préparer une demande, guider réservation et paiement, suivre une mission et aider les prestataires. Les décisions sensibles restent dans les moteurs déterministes KLYX : l’assistant ne décide jamais lui-même du paiement, du KYC, de l’éligibilité, du settlement ou d’un remboursement.",
    action: null,
  };
}

function accountProfile(
  locale: SupportedLocale,
  context: AccountContext
): KlyxDeterministicAssistantReply {
  const abilities = [
    context.canRequestServices ? "request" : null,
    context.canOfferServices ? "offer" : null,
  ].filter(Boolean);

  if (locale === "en") {
    return {
      reply: `Your KLYX account is available${context.firstName ? `, ${context.firstName}` : ""}. ${
        abilities.length === 2
          ? "It can request and offer services."
          : context.canOfferServices
            ? "It can offer services."
            : "It can request services."
      } I can help you understand the account or profile, while identity and permission changes remain controlled by KLYX account rules.`,
      action: { href: "/profile", label: "Open profile" },
    };
  }

  if (locale === "nl") {
    return {
      reply: `Je KLYX-account is beschikbaar${context.firstName ? `, ${context.firstName}` : ""}. ${
        abilities.length === 2
          ? "Je kunt diensten aanvragen en aanbieden."
          : context.canOfferServices
            ? "Je kunt diensten aanbieden."
            : "Je kunt diensten aanvragen."
      } Ik kan je helpen met account- en profielinformatie; identiteits- en bevoegdheidswijzigingen blijven onder de KLYX-regels vallen.`,
      action: { href: "/profile", label: "Profiel openen" },
    };
  }

  if (locale === "de") {
    return {
      reply: `Dein KLYX-Konto ist verfügbar${context.firstName ? `, ${context.firstName}` : ""}. ${
        abilities.length === 2
          ? "Du kannst Dienstleistungen anfragen und anbieten."
          : context.canOfferServices
            ? "Du kannst Dienstleistungen anbieten."
            : "Du kannst Dienstleistungen anfragen."
      } Ich kann Konto- und Profilinformationen erklären; Identitäts- und Berechtigungsänderungen bleiben durch die KLYX-Regeln kontrolliert.`,
      action: { href: "/profile", label: "Profil öffnen" },
    };
  }

  return {
    reply: `Ton compte KLYX est disponible${context.firstName ? `, ${context.firstName}` : ""}. ${
      abilities.length === 2
        ? "Il peut demander et proposer des services."
        : context.canOfferServices
          ? "Il peut proposer des services."
          : "Il peut demander des services."
    } Je peux t’aider à comprendre le compte et le profil ; les changements d’identité ou d’autorisation restent contrôlés par les règles KLYX.`,
    action: { href: "/profile", label: "Ouvrir le profil" },
  };
}

function payment(locale: SupportedLocale): KlyxDeterministicAssistantReply {
  if (locale === "en") {
    return {
      reply:
        "KLYX prepares payment only after the required user confirmation. Stripe executes the external payment operation and the KLYX ledger records financial truth. The assistant can explain the state, but it cannot approve, capture, transfer or settle money by itself.",
      action: { href: "/bookings", label: "View bookings" },
    };
  }
  if (locale === "nl") {
    return {
      reply:
        "KLYX bereidt betaling pas voor na de vereiste bevestiging van de gebruiker. Stripe voert de externe betaling uit en het KLYX-ledger bewaart de financiële waarheid. De assistent kan de status uitleggen, maar kan zelf geen betaling goedkeuren, innen, overboeken of settelen.",
      action: { href: "/bookings", label: "Boekingen bekijken" },
    };
  }
  if (locale === "de") {
    return {
      reply:
        "KLYX bereitet eine Zahlung erst nach der erforderlichen Bestätigung vor. Stripe führt die externe Zahlung aus und das KLYX-Ledger hält die finanzielle Wahrheit fest. Der Assistent kann den Status erklären, aber keine Zahlung selbst genehmigen, einziehen, übertragen oder setteln.",
      action: { href: "/bookings", label: "Buchungen ansehen" },
    };
  }
  return {
    reply:
      "KLYX prépare le paiement seulement après la confirmation requise de l’utilisateur. Stripe exécute l’opération de paiement externe et le ledger KLYX conserve la vérité financière. L’assistant peut expliquer l’état, mais il ne peut jamais autoriser, capturer, transférer ou settler de l’argent lui-même.",
    action: { href: "/bookings", label: "Voir les réservations" },
  };
}

function refund(locale: SupportedLocale): KlyxDeterministicAssistantReply {
  if (locale === "en") {
    return {
      reply:
        "A refund is decided by KLYX refund policy, booking state and the financial engines, then reconciled with Stripe and the KLYX ledger. The assistant may explain the result or guide you to the relevant booking; it never invents refund eligibility or executes a refund on its own.",
      action: { href: "/bookings", label: "View bookings" },
    };
  }
  if (locale === "nl") {
    return {
      reply:
        "Een terugbetaling wordt bepaald door het KLYX-terugbetalingsbeleid, de boekingsstatus en de financiële motoren, en daarna afgestemd met Stripe en het KLYX-ledger. De assistent kan het resultaat uitleggen of je naar de juiste boeking leiden, maar bepaalt nooit zelf de terugbetalingsrechten en voert nooit zelfstandig een terugbetaling uit.",
      action: { href: "/bookings", label: "Boekingen bekijken" },
    };
  }
  if (locale === "de") {
    return {
      reply:
        "Eine Erstattung wird durch die KLYX-Erstattungsregeln, den Buchungsstatus und die Finanz-Engines bestimmt und anschließend mit Stripe und dem KLYX-Ledger abgeglichen. Der Assistent kann das Ergebnis erklären oder zur Buchung führen, aber niemals selbst Erstattungsberechtigung erfinden oder eine Erstattung ausführen.",
      action: { href: "/bookings", label: "Buchungen ansehen" },
    };
  }
  return {
    reply:
      "Un remboursement est déterminé par la politique de remboursement KLYX, l’état de la réservation et les moteurs financiers, puis réconcilié avec Stripe et le ledger KLYX. L’assistant peut expliquer le résultat ou te guider vers la réservation concernée ; il n’invente jamais l’éligibilité et n’exécute jamais seul un remboursement.",
    action: { href: "/bookings", label: "Voir les réservations" },
  };
}

function providerHelp(locale: SupportedLocale): KlyxDeterministicAssistantReply {
  if (locale === "en") {
    return {
      reply:
        "For providers, KLYX can help define services, service area, availability and pricing, find compatible opportunities and explain verification. Activation, KYC, economic eligibility and payout readiness remain deterministic engine decisions.",
      action: { href: "/provider", label: "Open provider space" },
    };
  }
  if (locale === "nl") {
    return {
      reply:
        "Voor dienstverleners kan KLYX helpen met diensten, werkgebied, beschikbaarheid en prijzen, passende opdrachten zoeken en verificatie uitleggen. Activatie, KYC, economische eligibility en payout-readiness blijven beslissingen van deterministische motoren.",
      action: { href: "/provider", label: "Dienstverlenersruimte openen" },
    };
  }
  if (locale === "de") {
    return {
      reply:
        "Für Anbieter kann KLYX Dienstleistungen, Einsatzgebiet, Verfügbarkeit und Preise strukturieren, passende Chancen finden und Verifizierung erklären. Aktivierung, KYC, wirtschaftliche Eligibility und Auszahlungsbereitschaft bleiben Entscheidungen deterministischer Engines.",
      action: { href: "/provider", label: "Anbieterbereich öffnen" },
    };
  }
  return {
    reply:
      "Pour un prestataire, KLYX peut aider à définir les services, la zone, les disponibilités et les tarifs, rechercher des opportunités compatibles et expliquer la vérification. L’activation, le KYC, l’éligibilité économique et la capacité de recevoir des paiements restent des décisions des moteurs déterministes.",
    action: { href: "/provider", label: "Ouvrir l’espace prestataire" },
  };
}

function kyc(locale: SupportedLocale): KlyxDeterministicAssistantReply {
  if (locale === "en") {
    return {
      reply:
        "KYC verifies the identity of a provider. Sumsub supplies external verification evidence, while KLYX keeps its own eligibility rules. A successful external verification never lets the assistant declare economic eligibility or payout readiness by itself.",
      action: { href: "/provider/verification/sumsub", label: "Open verification" },
    };
  }
  if (locale === "nl") {
    return {
      reply:
        "KYC verifieert de identiteit van een dienstverlener. Sumsub levert extern verificatiebewijs, terwijl KLYX zijn eigen eligibility-regels behoudt. Een geslaagde externe verificatie geeft de assistent nooit het recht om zelf economische eligibility of payout-readiness te verklaren.",
      action: { href: "/provider/verification/sumsub", label: "Verificatie openen" },
    };
  }
  if (locale === "de") {
    return {
      reply:
        "KYC prüft die Identität eines Anbieters. Sumsub liefert externe Verifizierungsnachweise, während KLYX eigene Eligibility-Regeln behält. Eine erfolgreiche externe Prüfung erlaubt dem Assistenten niemals, selbst wirtschaftliche Eligibility oder Auszahlungsbereitschaft festzustellen.",
      action: { href: "/provider/verification/sumsub", label: "Verifizierung öffnen" },
    };
  }
  return {
    reply:
      "Le KYC vérifie l’identité d’un prestataire. Sumsub fournit la preuve de vérification externe, tandis que KLYX conserve ses propres règles d’éligibilité. Une vérification externe réussie ne permet jamais à l’assistant de déclarer lui-même l’éligibilité économique ou la capacité de recevoir un paiement.",
    action: { href: "/provider/verification/sumsub", label: "Ouvrir la vérification" },
  };
}

export function languageChangedReply(locale: SupportedLocale): KlyxDeterministicAssistantReply {
  if (locale === "en") return { reply: "Language changed to English.", action: null };
  if (locale === "nl") return { reply: "Taal gewijzigd naar Nederlands.", action: null };
  if (locale === "de") return { reply: "Sprache auf Deutsch geändert.", action: null };
  return { reply: "Langue changée en français.", action: null };
}

export function buildKlyxDeterministicAssistantReply(params: {
  capability: KlyxAssistantCapability;
  locale?: string | null;
  account?: AccountContext;
}): KlyxDeterministicAssistantReply | null {
  const locale = localeOf(params.locale);

  if (params.capability === "klyx_information") return klyxInformation(locale);
  if (params.capability === "account_profile") return accountProfile(locale, params.account ?? {});
  if (params.capability === "payment_explanation") return payment(locale);
  if (params.capability === "refund_explanation") return refund(locale);
  if (params.capability === "provider_help") return providerHelp(locale);
  if (params.capability === "kyc_explanation") return kyc(locale);

  return null;
}
