"use client";

import { useEffect, useState } from "react";
import { Download, Share2, Smartphone } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { translateKlyxPublicHome } from "@/lib/klyx-page-i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function InstallKlyxButton() {
  const { locale } = useKlyxLocale();
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  const t = (
    key:
      | "installKlyx"
      | "installInstalled"
      | "installIosTitle"
      | "installIosInstructions"
      | "installAutomatic"
  ) => translateKlyxPublicHome(locale, key);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
    }

    setPromptEvent(null);
  }

  if (installed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">
        <Smartphone size={18} />
        {t("installInstalled")}
      </div>
    );
  }

  if (promptEvent) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-500"
      >
        <Download size={18} />
        {t("installKlyx")}
      </button>
    );
  }

  if (ios) {
    return (
      <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
        <p className="flex items-center gap-2 font-bold text-foreground">
          <Share2 size={18} />
          {t("installIosTitle")}
        </p>
        <p className="mt-2">{t("installIosInstructions")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
      {t("installAutomatic")}
    </div>
  );
}
