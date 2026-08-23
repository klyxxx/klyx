import type { Metadata } from "next";
import { cookies } from "next/headers";

import TermsPageContent from "@/app/terms/TermsPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxTermsPage } from "@/lib/klyx-terms-page-i18n";

// KLYX_TERMS_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxTermsPage(locale, "metadataTitle"),
    description: translateKlyxTermsPage(locale, "metadataDescription"),
  };
}

export default function TermsPage() {
  return <TermsPageContent />;
}
