import type { Metadata } from "next";
import { cookies } from "next/headers";

import DeleteAccountPageContent from "@/app/delete-account/DeleteAccountPageContent";
import {
  KLYX_LANGUAGE_COOKIE_KEY,
  normalizeKlyxLocale,
} from "@/lib/klyx-i18n";
import { translateKlyxDeleteAccountPage } from "@/lib/klyx-delete-account-page-i18n";

// KLYX_DELETE_ACCOUNT_PAGE_SERVER_BOUNDARY
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeKlyxLocale(
    cookieStore.get(KLYX_LANGUAGE_COOKIE_KEY)?.value
  );

  return {
    title: translateKlyxDeleteAccountPage(locale, "metadataTitle"),
    description: translateKlyxDeleteAccountPage(locale, "metadataDescription"),
  };
}

export default function DeleteAccountPage() {
  return <DeleteAccountPageContent />;
}
