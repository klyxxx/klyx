import "server-only";

import { cookies, headers } from "next/headers";

import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
  resolveKlyxLocale,
  type KlyxLocale,
} from "@/lib/klyx-i18n";

type WeightedLanguage = {
  tag: string;
  quality: number;
  index: number;
};

export function parseKlyxAcceptLanguage(
  value: string | null | undefined
): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((entry, index): WeightedLanguage | null => {
      const [rawTag, ...parameters] = entry.trim().split(";");
      const tag = rawTag?.trim();

      if (!tag || tag === "*") {
        return null;
      }

      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().toLowerCase().startsWith("q=")
      );

      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.split("=")[1] ?? "")
        : 1;

      const quality = Number.isFinite(parsedQuality)
        ? Math.max(0, Math.min(1, parsedQuality))
        : 0;

      if (quality <= 0) {
        return null;
      }

      return {
        tag,
        quality,
        index,
      };
    })
    .filter((entry): entry is WeightedLanguage => entry !== null)
    .sort(
      (left, right) =>
        right.quality - left.quality || left.index - right.index
    )
    .map((entry) => entry.tag);
}

export async function getServerKlyxLocale(): Promise<KlyxLocale> {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value;

  if (savedLocale?.trim()) {
    return normalizeKlyxLocale(savedLocale);
  }

  const requestHeaders = await headers();
  const browserLanguages = parseKlyxAcceptLanguage(
    requestHeaders.get("accept-language")
  );

  return resolveKlyxLocale(browserLanguages);
}
