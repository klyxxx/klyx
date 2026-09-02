"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import ClientAssistantFlow from "@/app/components/ClientAssistantFlow";
import ClientRouteGuard from "@/app/components/ClientRouteGuard";

export default function AssistantHomePage() {
  return (
    <ClientRouteGuard>
      <main className="relative min-h-[calc(100vh-3.5rem)] px-4 pb-28 pt-14 sm:px-6 sm:pt-20 lg:min-h-screen lg:px-12 lg:pb-14 lg:pt-24">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full text-foreground transition hover:bg-muted sm:right-7 sm:top-7 lg:right-10 lg:top-8"
        >
          <Bell size={23} strokeWidth={1.8} />
        </Link>

        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <h1 className="max-w-3xl text-center text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
            Que dois-je organiser pour vous ?
          </h1>
          <p className="mt-3 max-w-xl text-center text-sm leading-6 text-muted-foreground sm:text-base">
            Décrivez le besoin naturellement. KLYX vous demande seulement ce qui manque.
          </p>

          <div className="mt-8 flex w-full justify-center sm:mt-10">
            <ClientAssistantFlow />
          </div>
        </div>
      </main>
    </ClientRouteGuard>
  );
}
