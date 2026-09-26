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
  type KlyxLocale,
} from "@/lib/klyx-i18n";
import {
  translateKlyxTolgeeRuntimeUi,
  type KlyxTolgeeUiMessageKey,
} from "@/lib/klyx-tolgee-runtime";

type KlyxLocaleContextValue = {
  locale: KlyxLocale;
  setLocale: (locale: string) => void;
  t: (key: KlyxTolgeeUiMessageKey) => string;
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

function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${KLYX_LANGUAGE_COOKIE_KEY}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
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
    const cookieLocale = readLocaleCookie();
    const saved = localStorage.getItem(KLYX_LANGUAGE_STORAGE_KEY);
    const next = cookieLocale
      ? normalizeKlyxSelectableLocale(cookieLocale)
      : saved
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

  useEffect(() => {
    // Assistant language changes arrive through Set-Cookie on the unified
    // server gateway. Synchronize that authoritative preference into the
    // client locale without requiring a reload or a second settings screen.
    function syncFromCookie() {
      const raw = readLocaleCookie();
      if (!raw) return;

      const next = normalizeKlyxSelectableLocale(raw);
      setLocaleState((current) => {
        if (current === next) return current;
        localStorage.setItem(KLYX_LANGUAGE_STORAGE_KEY, next);
        applyDocumentLocale(next);
        return next;
      });
    }

    const interval = window.setInterval(syncFromCookie, 750);
    window.addEventListener("focus", syncFromCookie);
    window.addEventListener("pageshow", syncFromCookie);
    syncFromCookie();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncFromCookie);
      window.removeEventListener("pageshow", syncFromCookie);
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
      t: (key) => translateKlyxTolgeeRuntimeUi(locale, key),
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
