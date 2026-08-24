import type { KlyxLocale } from "@/lib/klyx-i18n";

export type KlyxPublicReviewsMessageKey =
  | "eyebrow"
  | "title"
  | "description"
  | "verifiedReview"
  | "verifiedReviews"
  | "summaryEyebrow"
  | "summaryTitle"
  | "summaryDescription"
  | "identityVerified"
  | "averageRating"
  | "verifiedReviewsMetric"
  | "evaluatedMission"
  | "evaluatedMissions"
  | "score"
  | "trustIndicator"
  | "verification"
  | "notVerified"
  | "profileStatus"
  | "experience"
  | "year"
  | "years"
  | "declaredExperience"
  | "evidenceNotice"
  | "loading"
  | "loadError"
  | "emptyTitle"
  | "emptyDescription"
  | "verifiedBadge"
  | "noComment";

type Dictionary = Record<KlyxPublicReviewsMessageKey, string>;

const FR: Dictionary = {
  eyebrow: "Confiance KLYX",
  title: "Avis vérifiés",
  description: "Seuls les clients ayant terminé une mission avec ce prestataire peuvent publier ici.",
  verifiedReview: "avis vérifié",
  verifiedReviews: "avis vérifiés",
  summaryEyebrow: "Résumé de confiance",
  summaryTitle: "Ce que KLYX sait de ce prestataire",
  summaryDescription: "Ces indicateurs regroupent les missions, les avis vérifiés, l’expérience déclarée et les signaux de confiance KLYX.",
  identityVerified: "Identité vérifiée",
  averageRating: "Note moyenne",
  verifiedReviewsMetric: "Avis vérifiés",
  evaluatedMission: "mission évaluée",
  evaluatedMissions: "missions évaluées",
  score: "KLYX Score",
  trustIndicator: "Indicateur de confiance",
  verification: "Vérification",
  notVerified: "Non vérifiée",
  profileStatus: "Statut du profil",
  experience: "Expérience",
  year: "an",
  years: "ans",
  declaredExperience: "expérience déclarée",
  evidenceNotice: "Les avis affichés ici proviennent uniquement de missions KLYX terminées. Après un nouvel avis, KLYX recalcule les indicateurs de confiance du prestataire.",
  loading: "Chargement des avis...",
  loadError: "Impossible de charger les avis.",
  emptyTitle: "Aucun avis vérifié pour le moment",
  emptyDescription: "Les premiers avis apparaîtront après des missions terminées et confirmées.",
  verifiedBadge: "Vérifié",
  noComment: "Aucun commentaire.",
};

const EN: Dictionary = {
  eyebrow: "KLYX trust",
  title: "Verified reviews",
  description: "Only clients who completed a mission with this provider can post here.",
  verifiedReview: "verified review",
  verifiedReviews: "verified reviews",
  summaryEyebrow: "Trust summary",
  summaryTitle: "What KLYX knows about this provider",
  summaryDescription: "These indicators combine missions, verified reviews, declared experience and KLYX trust signals.",
  identityVerified: "Identity verified",
  averageRating: "Average rating",
  verifiedReviewsMetric: "Verified reviews",
  evaluatedMission: "mission reviewed",
  evaluatedMissions: "missions reviewed",
  score: "KLYX Score",
  trustIndicator: "Trust indicator",
  verification: "Verification",
  notVerified: "Not verified",
  profileStatus: "Profile status",
  experience: "Experience",
  year: "year",
  years: "years",
  declaredExperience: "declared experience",
  evidenceNotice: "Reviews shown here come only from completed KLYX missions. After a new review, KLYX recalculates the provider's trust indicators.",
  loading: "Loading reviews...",
  loadError: "Unable to load reviews.",
  emptyTitle: "No verified reviews yet",
  emptyDescription: "The first reviews will appear after completed and confirmed missions.",
  verifiedBadge: "Verified",
  noComment: "No comment.",
};

const NL: Dictionary = {
  eyebrow: "KLYX-vertrouwen",
  title: "Geverifieerde reviews",
  description: "Alleen klanten die een opdracht met deze dienstverlener hebben voltooid, kunnen hier publiceren.",
  verifiedReview: "geverifieerde review",
  verifiedReviews: "geverifieerde reviews",
  summaryEyebrow: "Vertrouwenssamenvatting",
  summaryTitle: "Wat KLYX over deze dienstverlener weet",
  summaryDescription: "Deze indicatoren combineren opdrachten, geverifieerde reviews, opgegeven ervaring en KLYX-vertrouwenssignalen.",
  identityVerified: "Identiteit geverifieerd",
  averageRating: "Gemiddelde score",
  verifiedReviewsMetric: "Geverifieerde reviews",
  evaluatedMission: "beoordeelde opdracht",
  evaluatedMissions: "beoordeelde opdrachten",
  score: "KLYX Score",
  trustIndicator: "Vertrouwensindicator",
  verification: "Verificatie",
  notVerified: "Niet geverifieerd",
  profileStatus: "Profielstatus",
  experience: "Ervaring",
  year: "jaar",
  years: "jaar",
  declaredExperience: "opgegeven ervaring",
  evidenceNotice: "De reviews hier komen uitsluitend van voltooide KLYX-opdrachten. Na een nieuwe review berekent KLYX de vertrouwensindicatoren van de dienstverlener opnieuw.",
  loading: "Reviews laden...",
  loadError: "Reviews konden niet worden geladen.",
  emptyTitle: "Nog geen geverifieerde reviews",
  emptyDescription: "De eerste reviews verschijnen na voltooide en bevestigde opdrachten.",
  verifiedBadge: "Geverifieerd",
  noComment: "Geen commentaar.",
};

const DE: Dictionary = {
  eyebrow: "KLYX-Vertrauen",
  title: "Verifizierte Bewertungen",
  description: "Nur Kunden, die einen Auftrag mit diesem Anbieter abgeschlossen haben, können hier veröffentlichen.",
  verifiedReview: "verifizierte Bewertung",
  verifiedReviews: "verifizierte Bewertungen",
  summaryEyebrow: "Vertrauensübersicht",
  summaryTitle: "Was KLYX über diesen Anbieter weiß",
  summaryDescription: "Diese Indikatoren bündeln Aufträge, verifizierte Bewertungen, angegebene Erfahrung und KLYX-Vertrauenssignale.",
  identityVerified: "Identität verifiziert",
  averageRating: "Durchschnittsbewertung",
  verifiedReviewsMetric: "Verifizierte Bewertungen",
  evaluatedMission: "bewerteter Auftrag",
  evaluatedMissions: "bewertete Aufträge",
  score: "KLYX Score",
  trustIndicator: "Vertrauensindikator",
  verification: "Verifizierung",
  notVerified: "Nicht verifiziert",
  profileStatus: "Profilstatus",
  experience: "Erfahrung",
  year: "Jahr",
  years: "Jahre",
  declaredExperience: "angegebene Erfahrung",
  evidenceNotice: "Die hier angezeigten Bewertungen stammen ausschließlich aus abgeschlossenen KLYX-Aufträgen. Nach einer neuen Bewertung berechnet KLYX die Vertrauensindikatoren des Anbieters neu.",
  loading: "Bewertungen werden geladen...",
  loadError: "Bewertungen konnten nicht geladen werden.",
  emptyTitle: "Noch keine verifizierten Bewertungen",
  emptyDescription: "Die ersten Bewertungen erscheinen nach abgeschlossenen und bestätigten Aufträgen.",
  verifiedBadge: "Verifiziert",
  noComment: "Kein Kommentar.",
};

const DICTIONARIES: Partial<Record<KlyxLocale, Dictionary>> = {
  fr: FR,
  en: EN,
  nl: NL,
  de: DE,
};

export function translateKlyxPublicReviews(
  locale: KlyxLocale,
  key: KlyxPublicReviewsMessageKey
): string {
  return DICTIONARIES[locale]?.[key] ?? FR[key];
}

export function getKlyxPublicReviewsIntlLocale(locale: KlyxLocale): string {
  if (locale === "en") return "en-GB";
  if (locale === "nl") return "nl-BE";
  if (locale === "de") return "de-DE";
  return "fr-BE";
}

export function formatKlyxPublicReviewCount(
  locale: KlyxLocale,
  count: number
): string {
  const key = count === 1 ? "verifiedReview" : "verifiedReviews";
  return `${count} ${translateKlyxPublicReviews(locale, key)}`;
}

export function formatKlyxEvaluatedMissionCount(
  locale: KlyxLocale,
  count: number
): string {
  const key = count === 1 ? "evaluatedMission" : "evaluatedMissions";
  return `${count} ${translateKlyxPublicReviews(locale, key)}`;
}

export function formatKlyxPublicReviewExperience(
  locale: KlyxLocale,
  years: number
): string {
  const key = years === 1 ? "year" : "years";
  return `${years} ${translateKlyxPublicReviews(locale, key)}`;
}
