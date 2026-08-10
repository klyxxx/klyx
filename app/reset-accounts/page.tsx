"use client";

import { useEffect } from "react";

export default function ResetAccountsPage() {
  useEffect(() => {
    const keys = [
      "klyx-saved-accounts-v1",
      "klyx-saved-accounts-v2",
      "klyx-saved-accounts-v3",
      "klyx-saved-accounts-v4",
      "klyx-active-account-id",
      "klyx-active-account-id-v3",
      "klyx-active-account-id-v4",
      "klyx_saved_accounts",
      "klyx-dev-test-accounts",
    ];

    for (const key of keys) {
      window.localStorage.removeItem(key);
    }

    window.location.assign("/accounts");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
      Réinitialisation des comptes...
    </main>
  );
}
