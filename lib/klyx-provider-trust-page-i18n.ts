import type { KlyxLocale } from "./klyx-i18n";

export const KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES = ["fr", "en", "nl", "de"] as const;
export type KlyxProviderTrustLocale = (typeof KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES)[number];

export const KLYX_PROVIDER_TRUST_MESSAGE_KEYS = [
  "sessionMissing","loadError","eyebrow","title","description","reportClient","receivedTitle","receivedDescription","receivedEmpty","openedTitle","openedDescription","openedEmpty","activity","viewMission",
] as const;
export type KlyxProviderTrustMessageKey = (typeof KLYX_PROVIDER_TRUST_MESSAGE_KEYS)[number];
type Dictionary = Record<KlyxProviderTrustMessageKey, string>;

const MESSAGES: Record<KlyxProviderTrustLocale, Dictionary> = {
  fr: {
    sessionMissing:"Session KLYX manquante.", loadError:"Impossible de charger les dossiers professionnels pour le moment.", eyebrow:"Protection professionnelle", title:"Centre de confiance prestataire", description:"Consulte les signalements reçus, suis tes dossiers et protège ton activité professionnelle.", reportClient:"Signaler un problème client", receivedTitle:"Signalements reçus", receivedDescription:"Dossiers ouverts contre ton profil professionnel.", receivedEmpty:"Aucun signalement reçu.", openedTitle:"Signalements ouverts par moi", openedDescription:"Dossiers que tu as ouverts concernant un client.", openedEmpty:"Aucun dossier ouvert par toi.", activity:"Activité professionnelle", viewMission:"Voir la mission",
  },
  en: {
    sessionMissing:"KLYX session missing.", loadError:"Professional cases are currently unavailable.", eyebrow:"Professional protection", title:"Provider Trust Center", description:"Review reports received, follow your cases, and protect your professional activity.", reportClient:"Report a client issue", receivedTitle:"Reports received", receivedDescription:"Cases opened against your professional profile.", receivedEmpty:"No report received.", openedTitle:"Reports opened by me", openedDescription:"Cases you opened concerning a client.", openedEmpty:"No case opened by you.", activity:"Professional activity", viewMission:"View mission",
  },
  nl: {
    sessionMissing:"KLYX-sessie ontbreekt.", loadError:"Professionele dossiers zijn momenteel niet beschikbaar.", eyebrow:"Professionele bescherming", title:"Vertrouwenscentrum voor dienstverleners", description:"Bekijk ontvangen meldingen, volg je dossiers en bescherm je professionele activiteit.", reportClient:"Een probleem met een klant melden", receivedTitle:"Ontvangen meldingen", receivedDescription:"Dossiers die tegen je professionele profiel zijn geopend.", receivedEmpty:"Geen melding ontvangen.", openedTitle:"Door mij geopende meldingen", openedDescription:"Dossiers die je over een klant hebt geopend.", openedEmpty:"Geen dossier door jou geopend.", activity:"Professionele activiteit", viewMission:"Missie bekijken",
  },
  de: {
    sessionMissing:"KLYX-Sitzung fehlt.", loadError:"Professionelle Fälle sind derzeit nicht verfügbar.", eyebrow:"Beruflicher Schutz", title:"Vertrauenszentrum für Dienstleister", description:"Sieh eingegangene Meldungen ein, verfolge deine Fälle und schütze deine berufliche Tätigkeit.", reportClient:"Problem mit einem Kunden melden", receivedTitle:"Eingegangene Meldungen", receivedDescription:"Fälle, die gegen dein berufliches Profil eröffnet wurden.", receivedEmpty:"Keine Meldung eingegangen.", openedTitle:"Von mir eröffnete Meldungen", openedDescription:"Fälle, die du zu einem Kunden eröffnet hast.", openedEmpty:"Kein Fall von dir eröffnet.", activity:"Berufliche Aktivität", viewMission:"Mission ansehen",
  },
};

const LOCALE_SET = new Set<string>(KLYX_PROVIDER_TRUST_TRANSLATED_LOCALES);
export function hasKlyxProviderTrustTranslation(locale: KlyxLocale) { return LOCALE_SET.has(locale); }
export function resolveKlyxProviderTrustLocale(locale: KlyxLocale): KlyxProviderTrustLocale { return hasKlyxProviderTrustTranslation(locale) ? (locale as KlyxProviderTrustLocale) : "fr"; }
export function getKlyxProviderTrustDictionary(locale: KlyxLocale) { return MESSAGES[resolveKlyxProviderTrustLocale(locale)]; }
export function translateKlyxProviderTrust(locale: KlyxLocale, key: KlyxProviderTrustMessageKey) { return getKlyxProviderTrustDictionary(locale)[key]; }
