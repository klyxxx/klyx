import {
  KLYX_REGISTERED_LANGUAGE_OPTIONS,
  type KlyxLocale,
} from "./klyx-i18n";
import { KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES } from "./klyx-page-i18n";
import { KLYX_LOGIN_PAGE_TRANSLATED_LOCALES } from "./klyx-auth-page-i18n";
import { KLYX_SIGNUP_PAGE_TRANSLATED_LOCALES } from "./klyx-signup-page-i18n";
import { KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES } from "./klyx-settings-page-i18n";
import { KLYX_PROFILE_PAGE_TRANSLATED_LOCALES } from "./klyx-profile-page-i18n";
import { KLYX_SEARCH_PAGE_TRANSLATED_LOCALES } from "./klyx-search-page-i18n";
import { KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES } from "./klyx-bookings-page-i18n";
import { KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES } from "./klyx-messages-page-i18n";
import { KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES } from "./klyx-message-conversation-i18n";
import { KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES } from "./klyx-request-confirm-i18n";
import { KLYX_PROVIDER_JOBS_TRANSLATED_LOCALES } from "./klyx-provider-jobs-i18n";
import { KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES } from "./klyx-provider-planning-i18n";
import { KLYX_PROVIDER_SKILLS_TRANSLATED_LOCALES } from "./klyx-provider-skills-i18n";
import { KLYX_PROVIDER_VERIFICATION_TRANSLATED_LOCALES } from "./klyx-provider-verification-i18n";
import { KLYX_PROVIDER_ZONES_TRANSLATED_LOCALES } from "./klyx-provider-zones-i18n";
import { KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES } from "./klyx-split-mission-checkout-i18n";
import { KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES } from "./klyx-split-mission-payment-confirmation-i18n";
import { KLYX_TERMS_PAGE_TRANSLATED_LOCALES } from "./klyx-terms-page-i18n";
import { KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES } from "./klyx-privacy-page-i18n";

export const KLYX_REQUIRED_LOCALE_READINESS_GROUPS = [
  "public-auth",
  "client-core",
  "provider-core",
  "transactional-legal",
] as const;

export type KlyxLocaleReadinessGroup =
  (typeof KLYX_REQUIRED_LOCALE_READINESS_GROUPS)[number];

export type KlyxCriticalLocaleSurface = {
  id: string;
  group: KlyxLocaleReadinessGroup;
  locales: readonly string[];
};

export const KLYX_CRITICAL_LOCALE_SURFACES = [
  {
    id: "public.entry-home",
    group: "public-auth",
    locales: KLYX_PUBLIC_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "auth.login",
    group: "public-auth",
    locales: KLYX_LOGIN_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "auth.signup",
    group: "public-auth",
    locales: KLYX_SIGNUP_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "client.settings",
    group: "client-core",
    locales: KLYX_SETTINGS_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "client.profile",
    group: "client-core",
    locales: KLYX_PROFILE_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "client.search",
    group: "client-core",
    locales: KLYX_SEARCH_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "client.activity-bookings",
    group: "client-core",
    locales: KLYX_BOOKINGS_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "client.messages-overview",
    group: "client-core",
    locales: KLYX_MESSAGES_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "client.message-conversation",
    group: "client-core",
    locales: KLYX_MESSAGE_CONVERSATION_TRANSLATED_LOCALES,
  },
  {
    id: "client.request-confirmation",
    group: "client-core",
    locales: KLYX_REQUEST_CONFIRM_TRANSLATED_LOCALES,
  },
  {
    id: "provider.jobs",
    group: "provider-core",
    locales: KLYX_PROVIDER_JOBS_TRANSLATED_LOCALES,
  },
  {
    id: "provider.planning",
    group: "provider-core",
    locales: KLYX_PROVIDER_PLANNING_TRANSLATED_LOCALES,
  },
  {
    id: "provider.skills",
    group: "provider-core",
    locales: KLYX_PROVIDER_SKILLS_TRANSLATED_LOCALES,
  },
  {
    id: "provider.verification",
    group: "provider-core",
    locales: KLYX_PROVIDER_VERIFICATION_TRANSLATED_LOCALES,
  },
  {
    id: "provider.zones",
    group: "provider-core",
    locales: KLYX_PROVIDER_ZONES_TRANSLATED_LOCALES,
  },
  {
    id: "transaction.split-checkout",
    group: "transactional-legal",
    locales: KLYX_SPLIT_MISSION_CHECKOUT_TRANSLATED_LOCALES,
  },
  {
    id: "transaction.payment-confirmation",
    group: "transactional-legal",
    locales: KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_TRANSLATED_LOCALES,
  },
  {
    id: "legal.terms",
    group: "transactional-legal",
    locales: KLYX_TERMS_PAGE_TRANSLATED_LOCALES,
  },
  {
    id: "legal.privacy",
    group: "transactional-legal",
    locales: KLYX_PRIVACY_PAGE_TRANSLATED_LOCALES,
  },
] as const satisfies readonly KlyxCriticalLocaleSurface[];

function supportsLocale(
  locales: readonly string[],
  locale: KlyxLocale
): boolean {
  return locales.includes(locale);
}

export function getKlyxLocaleReadiness(locale: KlyxLocale) {
  const missingSurfaces = KLYX_CRITICAL_LOCALE_SURFACES
    .filter((surface) => !supportsLocale(surface.locales, locale))
    .map((surface) => ({
      id: surface.id,
      group: surface.group,
    }));

  return {
    locale,
    ready: missingSurfaces.length === 0,
    missingSurfaces,
  } as const;
}

export function isKlyxLocaleEndToEndReady(locale: KlyxLocale): boolean {
  return getKlyxLocaleReadiness(locale).ready;
}

export const KLYX_END_TO_END_READY_LOCALES =
  KLYX_REGISTERED_LANGUAGE_OPTIONS
    .map((option) => option.value)
    .filter(isKlyxLocaleEndToEndReady);
