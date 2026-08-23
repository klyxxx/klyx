import type { Metadata } from "next";
import { cookies } from "next/headers";

import PrivacyPageContent from "@/app/privacy/PrivacyPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxPrivacyPage } from "@/lib/klyx-privacy-page-i18n";

// KLYX_PRIVACY_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxPrivacyPage(locale, "metadataTitle"),
    description: translateKlyxPrivacyPage(locale, "metadataDescription"),
  };
}

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}
