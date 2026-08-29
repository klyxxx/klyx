"use client";

import AssistantCommandBar from "@/app/components/AssistantCommandBar";
import ClientRouteGuard from "@/app/components/ClientRouteGuard";

export default function AssistantHomePage() {
  return (
    <ClientRouteGuard>
      <main className="min-h-[calc(100vh-3.5rem)] px-4 pb-28 pt-10 sm:px-6 sm:pt-16 lg:min-h-screen lg:px-10 lg:pb-12 lg:pt-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
          <header className="max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              KLYX
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              Que puis-je organiser pour vous ?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              Décrivez simplement votre besoin. KLYX demande uniquement ce qui manque,
              prépare un résumé modifiable et vous laisse confirmer chaque action importante.
            </p>
          </header>

          <div className="mt-8 w-full max-w-3xl sm:mt-10">
            <AssistantCommandBar />
          </div>

          <p className="mt-5 max-w-xl text-center text-[11px] leading-5 text-muted-foreground">
            KLYX ne suppose jamais un prix ou une disponibilité et n’effectue aucune
            réservation, sélection ou action sensible sans votre confirmation.
          </p>
        </div>
      </main>
    </ClientRouteGuard>
  );
}
