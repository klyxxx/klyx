import type { Metadata } from "next";
import { cookies } from "next/headers";

import OfflinePageContent from "@/app/offline/OfflinePageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxOfflinePage } from "@/lib/klyx-offline-page-i18n";

// KLYX_OFFLINE_PAGE_SERVER_BOUNDARY_16_12
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxOfflinePage(locale, "metadataTitle"),
    description: translateKlyxOfflinePage(locale, "metadataDescription"),
  };
}

export default function OfflinePage() {
  return <OfflinePageContent />;
}
