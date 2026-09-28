import de from "./i18n/catalogs/de.json";
import en from "./i18n/catalogs/en.json";
import fr from "./i18n/catalogs/fr.json";
import nl from "./i18n/catalogs/nl.json";

type Catalog = Record<string, string>;

const catalogs: Record<string, Catalog> = { fr, en, nl, de };

export function normalizeLocale(locale?: string | null): "fr" | "en" | "nl" | "de" {
  const short = locale?.toLowerCase().split(/[-_]/)[0];
  return short === "en" || short === "nl" || short === "de" ? short : "fr";
}

export function t(
  key: string,
  fallback: string,
  locale: "fr" | "en" | "nl" | "de" = "fr"
): string {
  return catalogs[locale]?.[key] ?? catalogs.fr?.[key] ?? fallback;
}
