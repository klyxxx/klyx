import {
  formatKlyxBookingService,
  resolveKlyxBookingsPageLocale,
} from "@/lib/klyx-bookings-page-i18n";

const SERVICE_SLUG_ALIASES: Record<
  string,
  "babysitting" | "cleaning" | "moving" | "handyman"
> = {
  babysitting: "babysitting",
  "baby-sitting": "babysitting",
  cleaning: "cleaning",
  "menage-a-domicile": "cleaning",
  menage: "cleaning",
  moving: "moving",
  demenagement: "moving",
  handyman: "handyman",
  bricolage: "handyman",
};

const SERVICE_LABELS = {
  fr: {
    babysitting: "Baby-sitting",
    cleaning: "Ménage",
    moving: "Déménagement",
    handyman: "Bricolage",
  },
  en: {
    babysitting: "Babysitting",
    cleaning: "Cleaning",
    moving: "Moving",
    handyman: "Handyman",
  },
  nl: {
    babysitting: "Babysitting",
    cleaning: "Schoonmaak",
    moving: "Verhuizing",
    handyman: "Kluswerk",
  },
  de: {
    babysitting: "Babysitting",
    cleaning: "Reinigung",
    moving: "Umzug",
    handyman: "Handwerksservice",
  },
} as const;

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

export function formatKlyxBookingServiceFromSlug(
  locale: string,
  serviceSlug: string | null | undefined,
  serviceLabel: string
): string {
  const slug = serviceSlug?.trim();

  if (!slug) {
    return formatKlyxBookingService(locale, serviceLabel);
  }

  const canonical = SERVICE_SLUG_ALIASES[normalizeSlug(slug)];
  if (!canonical) {
    return serviceLabel;
  }

  return SERVICE_LABELS[resolveKlyxBookingsPageLocale(locale)][canonical];
}
