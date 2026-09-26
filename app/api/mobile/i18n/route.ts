import { NextResponse } from "next/server";

import {
  KLYX_TOLGEE_RUNTIME_CATALOGS,
} from "@/lib/klyx-tolgee-runtime";
import type { KlyxSelectableLocale } from "@/lib/klyx-i18n";

const LOCALES = new Set<KlyxSelectableLocale>(["fr", "en", "nl", "de"]);

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale")?.trim() ?? "fr";

  if (!LOCALES.has(locale as KlyxSelectableLocale)) {
    return NextResponse.json(
      { error: "Langue non prise en charge.", code: "KLYX_MOBILE_LOCALE_UNSUPPORTED" },
      { status: 400 }
    );
  }

  const catalog = KLYX_TOLGEE_RUNTIME_CATALOGS[locale as KlyxSelectableLocale];

  return NextResponse.json(
    { locale, catalog },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
  );
}
