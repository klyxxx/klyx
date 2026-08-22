import {
  KLYX_BATCH_1_LANGUAGE_OPTIONS,
  KLYX_BATCH_1_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_1_UI_MESSAGES,
  KLYX_EN_NAVIGATION_TRANSLATIONS,
} from "./klyx-i18n-batch-1";
import {
  KLYX_BATCH_2_LANGUAGE_OPTIONS,
  KLYX_BATCH_2_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_2_UI_MESSAGES,
} from "./klyx-i18n-batch-2";
import {
  KLYX_BATCH_3_LANGUAGE_OPTIONS,
  KLYX_BATCH_3_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_3_UI_MESSAGES,
} from "./klyx-i18n-batch-3";
import {
  KLYX_BATCH_4_LANGUAGE_OPTIONS,
  KLYX_BATCH_4_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_4_UI_MESSAGES,
} from "./klyx-i18n-batch-4";
import {
  KLYX_BATCH_5_LANGUAGE_OPTIONS,
  KLYX_BATCH_5_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_5_UI_MESSAGES,
} from "./klyx-i18n-batch-5";
import {
  KLYX_BATCH_6_LANGUAGE_OPTIONS,
  KLYX_BATCH_6_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_6_UI_MESSAGES,
} from "./klyx-i18n-batch-6";
import {
  KLYX_BATCH_7_LANGUAGE_OPTIONS,
  KLYX_BATCH_7_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_7_UI_MESSAGES,
} from "./klyx-i18n-batch-7";
import {
  KLYX_BATCH_8_LANGUAGE_OPTIONS,
  KLYX_BATCH_8_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_8_UI_MESSAGES,
} from "./klyx-i18n-batch-8";
import {
  KLYX_BATCH_9_LANGUAGE_OPTIONS,
  KLYX_BATCH_9_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_9_UI_MESSAGES,
} from "./klyx-i18n-batch-9";
import {
  KLYX_BATCH_10_LANGUAGE_OPTIONS,
  KLYX_BATCH_10_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_10_UI_MESSAGES,
} from "./klyx-i18n-batch-10";
import {
  KLYX_BATCH_11_LANGUAGE_OPTIONS,
  KLYX_BATCH_11_NAVIGATION_TRANSLATIONS,
  KLYX_BATCH_11_UI_MESSAGES,
} from "./klyx-i18n-batch-11";

export const KLYX_LANGUAGE_OPTIONS = [
  ...KLYX_BATCH_1_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_2_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_3_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_4_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_5_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_6_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_7_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_8_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_9_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_10_LANGUAGE_OPTIONS,
  ...KLYX_BATCH_11_LANGUAGE_OPTIONS,
] as const;

export const KLYX_LOCALES = KLYX_LANGUAGE_OPTIONS.map(
  (option) => option.value
);

export type KlyxLocale =
  (typeof KLYX_LANGUAGE_OPTIONS)[number]["value"];

export const KLYX_DEFAULT_LOCALE: KlyxLocale = "fr";

export const KLYX_LANGUAGE_STORAGE_KEY = "klyx_language";
export const KLYX_LANGUAGE_COOKIE_KEY = "klyx_locale";

export type KlyxUiMessageKey =
  | "skipToMain"
  | "sidebar.providerTagline"
  | "sidebar.clientTagline"
  | "sidebar.loadingProfile"
  | "sidebar.providerAccount"
  | "sidebar.clientAccount"
  | "sidebar.searchPlaceholder"
  | "sidebar.noResults"
  | "sidebar.adminCenter"
  | "sidebar.loggingOut"
  | "sidebar.logout"
  | "sidebar.openMenu"
  | "sidebar.closeMenu";

type UiMessages = Record<KlyxUiMessageKey, string>;

const UI_MESSAGES = {
  ...KLYX_BATCH_1_UI_MESSAGES,
  ...KLYX_BATCH_2_UI_MESSAGES,
  ...KLYX_BATCH_3_UI_MESSAGES,
  ...KLYX_BATCH_4_UI_MESSAGES,
  ...KLYX_BATCH_5_UI_MESSAGES,
  ...KLYX_BATCH_6_UI_MESSAGES,
  ...KLYX_BATCH_7_UI_MESSAGES,
  ...KLYX_BATCH_8_UI_MESSAGES,
  ...KLYX_BATCH_9_UI_MESSAGES,
  ...KLYX_BATCH_10_UI_MESSAGES,
  ...KLYX_BATCH_11_UI_MESSAGES,
} as Record<KlyxLocale, UiMessages>;

const NAVIGATION_TRANSLATIONS = {
  ...KLYX_BATCH_1_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_2_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_3_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_4_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_5_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_6_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_7_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_8_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_9_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_10_NAVIGATION_TRANSLATIONS,
  ...KLYX_BATCH_11_NAVIGATION_TRANSLATIONS,
} as Partial<Record<KlyxLocale, Record<string, string>>>;

const LOCALE_VALUE_SET = new Set<string>(
  KLYX_LANGUAGE_OPTIONS.map((option) => option.value)
);

const LEGACY_BROWSER_ALIASES: Record<string, KlyxLocale> = {
  iw: "he",
  in: "id",
};

function normalizeLocaleToken(value: string) {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function resolveChineseLocale(normalized: string): KlyxLocale | null {
  if (
    normalized === "zh-hant" ||
    normalized.startsWith("zh-hant-") ||
    normalized === "zh-tw" ||
    normalized.startsWith("zh-tw-") ||
    normalized === "zh-hk" ||
    normalized.startsWith("zh-hk-") ||
    normalized === "zh-mo" ||
    normalized.startsWith("zh-mo-")
  ) {
    return "zh-hant";
  }

  if (
    normalized === "zh" ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-") ||
    normalized === "zh-cn" ||
    normalized.startsWith("zh-cn-") ||
    normalized === "zh-sg" ||
    normalized.startsWith("zh-sg-")
  ) {
    return "zh-hans";
  }

  return null;
}

function resolveSupportedToken(normalized: string): KlyxLocale | null {
  const chinese = resolveChineseLocale(normalized);
  if (chinese) return chinese;

  const direct = normalized.split("-")[0];
  const legacyAlias = LEGACY_BROWSER_ALIASES[direct];
  if (legacyAlias) return legacyAlias;

  if (LOCALE_VALUE_SET.has(direct)) {
    return direct as KlyxLocale;
  }

  return null;
}

export function normalizeKlyxLocale(
  value: string | null | undefined
): KlyxLocale {
  if (!value?.trim()) {
    return KLYX_DEFAULT_LOCALE;
  }

  return (
    resolveSupportedToken(normalizeLocaleToken(value)) ??
    KLYX_DEFAULT_LOCALE
  );
}

export function resolveKlyxLocale(
  candidates: readonly string[]
): KlyxLocale {
  for (const candidate of candidates) {
    const resolved = resolveSupportedToken(
      normalizeLocaleToken(candidate)
    );

    if (resolved) return resolved;
  }

  return KLYX_DEFAULT_LOCALE;
}

export function getKlyxLocaleMetadata(locale: KlyxLocale) {
  return KLYX_LANGUAGE_OPTIONS.find(
    (option) => option.value === locale
  )!;
}

export function translateKlyxUi(
  locale: KlyxLocale,
  key: KlyxUiMessageKey
) {
  return UI_MESSAGES[locale][key];
}

export function translateKlyxNavigationLabel(
  locale: KlyxLocale,
  frenchLabel: string
) {
  if (locale === "fr") {
    return frenchLabel;
  }

  return (
    NAVIGATION_TRANSLATIONS[locale]?.[frenchLabel] ??
    KLYX_EN_NAVIGATION_TRANSLATIONS[frenchLabel] ??
    frenchLabel
  );
}
