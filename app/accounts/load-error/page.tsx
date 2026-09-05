"use client";

import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";

function copy(locale: string) {
  if (locale === "en") {
    return {
      title: "Profiles could not be loaded",
      description:
        "KLYX has not confirmed the current state of your profiles, so profile actions are temporarily disabled.",
      retry: "Try again",
      back: "Back to dashboard",
    };
  }

  if (locale === "nl") {
    return {
      title: "Profielen konden niet worden geladen",
      description:
        "KLYX heeft de huidige status van je profielen niet kunnen bevestigen. Profielacties zijn daarom tijdelijk uitgeschakeld.",
      retry: "Opnieuw proberen",
      back: "Terug naar dashboard",
    };
  }

  if (locale === "de") {
    return {
      title: "Profile konnten nicht geladen werden",
      description:
        "KLYX konnte den aktuellen Stand deiner Profile nicht bestätigen. Profilaktionen sind daher vorübergehend deaktiviert.",
      retry: "Erneut versuchen",
      back: "Zurück zum Dashboard",
    };
  }

  return {
    title: "Impossible de charger les profils",
    description:
      "KLYX n’a pas pu confirmer l’état actuel de tes profils. Les actions sur les profils sont donc temporairement désactivées.",
    retry: "Réessayer",
    back: "Retour au tableau de bord",
  };
}

export default function AccountsLoadErrorPage() {
  const { locale } = useKlyxLocale();
  const labels = copy(locale);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <section
        role="alert"
        className="w-full max-w-lg rounded-3xl border border-amber-500/25 bg-card p-6 text-center shadow-sm sm:p-8"
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
          <AlertTriangle size={28} />
        </span>

        <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em]">
          {labels.title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {labels.description}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="/accounts"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            {labels.retry}
          </a>
          <a
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold transition hover:bg-muted"
          >
            <ArrowLeft size={16} />
            {labels.back}
          </a>
        </div>
      </section>
    </main>
  );
}
