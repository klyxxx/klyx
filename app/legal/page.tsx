import type { Metadata } from "next";
import { cookies } from "next/headers";

import LegalPageContent from "@/app/legal/LegalPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxLegalPage } from "@/lib/klyx-legal-page-i18n";

// KLYX_LEGAL_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxLegalPage(locale, "metadataTitle"),
    description: translateKlyxLegalPage(locale, "metadataDescription"),
  };
}

export default function LegalPage() {
  return <LegalPageContent />;
}
