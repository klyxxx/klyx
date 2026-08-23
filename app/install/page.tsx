import type { Metadata } from "next";
import { cookies } from "next/headers";

import InstallPageContent from "@/app/install/InstallPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxInstallPage } from "@/lib/klyx-install-page-i18n";

// KLYX_INSTALL_PAGE_SERVER_BOUNDARY_16_11
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxInstallPage(locale, "metadataTitle"),
    description: translateKlyxInstallPage(locale, "metadataDescription"),
  };
}

export default function InstallPage() {
  return <InstallPageContent />;
}
