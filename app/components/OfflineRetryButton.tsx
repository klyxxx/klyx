"use client";

import { RefreshCw, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { translateKlyxOfflinePage } from "@/lib/klyx-offline-page-i18n";

export default function OfflineRetryButton() {
  const { locale } = useKlyxLocale();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined"
      ? navigator.onLine
      : false
  );

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function retry() {
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={retry}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
    >
      {online ? <Wifi size={18} /> : <RefreshCw size={18} />}
      {translateKlyxOfflinePage(
        locale,
        online ? "retryOnline" : "retryOffline"
      )}
    </button>
  );
}
