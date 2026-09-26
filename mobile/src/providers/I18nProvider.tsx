import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { mobileConfig } from "@/src/config";

type Locale = "fr" | "en" | "nl" | "de";
type Catalog = Record<string, string>;

type I18nValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: string, fallback?: string): string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<Locale>("fr");
  const [catalog, setCatalog] = useState<Catalog>({});

  useEffect(() => {
    let active = true;
    void fetch(`${mobileConfig.apiUrl}/api/mobile/i18n?locale=${locale}`)
      .then((response) => response.json())
      .then((payload: { catalog?: Catalog }) => {
        if (active) setCatalog(payload.catalog ?? {});
      })
      .catch(() => {
        if (active) setCatalog({});
      });
    return () => {
      active = false;
    };
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t(key, fallback) {
        return catalog[key] ?? fallback ?? key;
      },
    }),
    [catalog, locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider missing");
  return value;
}
