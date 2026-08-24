import type { KlyxLocale } from "./klyx-i18n";
import {
  formatKlyxFounderAnalyticsDate,
  formatKlyxFounderAnalyticsNumber,
  resolveKlyxFounderAnalyticsLocale,
} from "./klyx-founder-analytics-i18n";

export function formatKlyxFounderAnalyticsWithResults(locale: KlyxLocale, count: number) {
  const value = formatKlyxFounderAnalyticsNumber(locale, count);
  switch (resolveKlyxFounderAnalyticsLocale(locale)) {
    case "en": return `${value} with results`;
    case "nl": return `${value} met resultaat`;
    case "de": return `${value} mit Ergebnis`;
    default: return `${value} avec résultat`;
  }
}

export function formatKlyxFounderAnalyticsAccepted(locale: KlyxLocale, count: number) {
  const value = formatKlyxFounderAnalyticsNumber(locale, count);
  switch (resolveKlyxFounderAnalyticsLocale(locale)) {
    case "en": return `${value} accepted in the period`;
    case "nl": return `${value} geaccepteerd in de periode`;
    case "de": return `${value} im Zeitraum akzeptiert`;
    default: return `${value} acceptées sur la période`;
  }
}

export function formatKlyxFounderAnalyticsCompleted(locale: KlyxLocale, count: number) {
  const value = formatKlyxFounderAnalyticsNumber(locale, count);
  switch (resolveKlyxFounderAnalyticsLocale(locale)) {
    case "en": return `${value} completed`;
    case "nl": return `${value} voltooid`;
    case "de": return `${value} abgeschlossen`;
    default: return `${value} terminées`;
  }
}

export function formatKlyxFounderAnalyticsDailyTooltip(
  locale: KlyxLocale,
  date: string,
  searches: number,
  successShare: number
) {
  const formattedDate = formatKlyxFounderAnalyticsDate(locale, date);
  const count = formatKlyxFounderAnalyticsNumber(locale, searches);
  switch (resolveKlyxFounderAnalyticsLocale(locale)) {
    case "en": return `${formattedDate}: ${count} search(es), ${successShare}% with results`;
    case "nl": return `${formattedDate}: ${count} zoekopdracht(en), ${successShare}% met resultaat`;
    case "de": return `${formattedDate}: ${count} Suche(n), ${successShare}% mit Ergebnis`;
    default: return `${formattedDate} : ${count} recherche(s), ${successShare}% avec résultat`;
  }
}
