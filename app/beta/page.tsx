import type { Metadata } from "next";
import { cookies } from "next/headers";

import BetaPageContent from "@/app/beta/BetaPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxBetaPage } from "@/lib/klyx-beta-page-i18n";

// KLYX_BETA_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxBetaPage(locale, "metadataTitle"),
    description: translateKlyxBetaPage(locale, "metadataDescription"),
  };
}

export default function BetaPage() {
  return <BetaPageContent />;
}
