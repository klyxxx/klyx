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
  normalizeKlyxLocale,
  resolveKlyxLocale,
  translateKlyxUi,
  type KlyxLocale,
  type KlyxUiMessageKey,
} from "@/lib/klyx-i18n";

type KlyxLocaleContextValue = {
  locale: KlyxLocale;
  setLocale: (locale: string) => void;
  t: (key: KlyxUiMessageKey) => string;
};

const KlyxLocaleContext =
  createContext<KlyxLocaleContextValue | null>(null);

function writeLocalePreference(locale: KlyxLocale) {
  localStorage.setItem(
    KLYX_LANGUAGE_STORAGE_KEY,
    locale
  );

  document.cookie = `${KLYX_LANGUAGE_COOKIE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.documentElement.dataset.klyxLocale = locale;
}

export default function KlyxLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] =
    useState<KlyxLocale>(KLYX_DEFAULT_LOCALE);

  useEffect(() => {
    const saved = localStorage.getItem(
      KLYX_LANGUAGE_STORAGE_KEY
    );

    const initial = saved
      ? normalizeKlyxLocale(saved)
      : resolveKlyxLocale(
          navigator.languages?.length
            ? navigator.languages
            : [navigator.language]
        );

    setLocaleState(initial);
    writeLocalePreference(initial);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.key !== KLYX_LANGUAGE_STORAGE_KEY ||
        event.newValue == null
      ) {
        return;
      }

      const next = normalizeKlyxLocale(
        event.newValue
      );

      setLocaleState(next);
      document.documentElement.lang = next;
      document.documentElement.dataset.klyxLocale = next;
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(
        "storage",
        onStorage
      );
    };
  }, []);

  const setLocale = useCallback(
    (value: string) => {
      const next = normalizeKlyxLocale(value);

      setLocaleState(next);
      writeLocalePreference(next);
    },
    []
  );

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
