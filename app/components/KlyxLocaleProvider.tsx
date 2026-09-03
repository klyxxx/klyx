"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  KLYX_DEFAULT_LOCALE,
  KLYX_LANGUAGE_COOKIE_KEY,
  KLYX_LANGUAGE_STORAGE_KEY,
  getKlyxLocaleMetadata,
  normalizeKlyxSelectableLocale,
  translateKlyxUi,
  type KlyxLocale,
  type KlyxUiMessageKey,
} from "@/lib/klyx-i18n";

type KlyxLocaleContextValue = {
  locale: KlyxLocale;
  setLocale: (locale: string) => void;
  t: (key: KlyxUiMessageKey) => string;
};

type KlyxLocaleProviderProps = {
  children: React.ReactNode;
  initialLocale?: KlyxLocale;
};

const KlyxLocaleContext =
  createContext<KlyxLocaleContextValue | null>(null);

function applyDocumentLocale(locale: KlyxLocale) {
  const metadata = getKlyxLocaleMetadata(locale);

  document.documentElement.lang = metadata.htmlLang;
  document.documentElement.dir = metadata.dir;
  document.documentElement.dataset.klyxLocale = locale;
}

function writeLocalePreference(locale: KlyxLocale) {
  localStorage.setItem(
    KLYX_LANGUAGE_STORAGE_KEY,
    locale
  );

  document.cookie = `${KLYX_LANGUAGE_COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  applyDocumentLocale(locale);
}

export default function KlyxLocaleProvider({
  children,
  initialLocale = KLYX_DEFAULT_LOCALE,
}: KlyxLocaleProviderProps) {
  const [locale, setLocaleState] = useState<KlyxLocale>(() =>
    normalizeKlyxSelectableLocale(initialLocale)
  );

  useEffect(() => {
    const saved = localStorage.getItem(KLYX_LANGUAGE_STORAGE_KEY);
    const next = saved
      ? normalizeKlyxSelectableLocale(saved)
      : normalizeKlyxSelectableLocale(initialLocale);

    setLocaleState(next);
    writeLocalePreference(next);
  }, [initialLocale]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.key !== KLYX_LANGUAGE_STORAGE_KEY ||
        event.newValue == null
      ) {
        return;
      }

      const next = normalizeKlyxSelectableLocale(event.newValue);

      setLocaleState(next);
      applyDocumentLocale(next);
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLocale = useCallback((value: string) => {
    const next = normalizeKlyxSelectableLocale(value);

    setLocaleState(next);
    writeLocalePreference(next);
  }, []);

  const value = useMemo<KlyxLocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translateKlyxUi(locale, key),
    }),
    [locale, setLocale]
  );

  return (
    <KlyxLocaleContext.Provider value={value}>
      {children}
    </KlyxLocaleContext.Provider>
  );
}

export function useKlyxLocale() {
  const context = useContext(KlyxLocaleContext);

  if (!context) {
    throw new Error(
      "useKlyxLocale must be used inside KlyxLocaleProvider"
    );
  }

  return context;
}
