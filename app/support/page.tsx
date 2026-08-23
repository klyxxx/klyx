import type { Metadata } from "next";
import { cookies } from "next/headers";

import SupportPageContent from "@/app/support/SupportPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxSupportPage } from "@/lib/klyx-support-page-i18n";

// KLYX_SUPPORT_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxSupportPage(locale, "metadataTitle"),
    description: translateKlyxSupportPage(locale, "metadataDescription"),
  };
}

export default function SupportPage() {
  return <SupportPageContent />;
}
