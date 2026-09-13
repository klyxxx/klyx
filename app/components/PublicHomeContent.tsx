"use client";

import Link from "next/link";
import { ArrowRight, Camera, Download, Mic, ShieldCheck } from "lucide-react";

import InstallKlyxButton from "@/app/components/InstallKlyxButton";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import PublicSessionActions from "@/app/components/PublicSessionActions";
import KlyxLogo from "@/app/ui/KlyxLogo";

type HomeCopy = {
  badge: string;
  title: string;
  description: string;
  placeholder: string;
  openAssistant: string;
  examples: readonly string[];
  principleTitle: string;
  principleText: string;
  install: string;
  installTitle: string;
  installText: string;
};

const COPY: Record<string, HomeCopy> = {
  fr: {
    badge: "Un seul assistant KLYX",
    title: "Que veux-tu obtenir ou gagner ?",
    description:
      "Demande un service, cherche des missions rémunérées, gère une mission existante ou pose une question. KLYX comprend l’intention depuis la même conversation.",
    placeholder: "Écris simplement ce que tu veux faire…",
    openAssistant: "Ouvrir KLYX",
    examples: [
      "Trouve-moi quelqu’un pour monter mon armoire demain après 18h.",
      "Je suis libre samedi, je veux gagner environ 100 € près de chez moi.",
      "Où en est ma mission de demain ?",
    ],
    principleTitle: "Pas de mode client ou prestataire",
    principleText:
      "Un compte, un historique et un assistant. L’intention de chaque message détermine l’action utile, sans changement artificiel de profil.",
    install: "Installer",
    installTitle: "Le même KLYX sur tous tes appareils",
    installText:
      "Retrouve le même compte et le même assistant depuis ton ordinateur ou ton téléphone.",
  },
  en: {
    badge: "One KLYX assistant",
    title: "What do you want to get or earn?",
    description:
      "Request a service, find paid work, manage an existing mission or ask a question. KLYX understands the intent in the same conversation.",
    placeholder: "Just describe what you want to do…",
    openAssistant: "Open KLYX",
    examples: [
      "Find someone to assemble my wardrobe tomorrow after 6 pm.",
      "I’m free Saturday and want to earn about €100 near me.",
      "What is the status of my mission tomorrow?",
    ],
    principleTitle: "No client or provider mode",
    principleText:
      "One account, one history and one assistant. Each message determines the useful action without artificial profile switching.",
    install: "Install",
    installTitle: "The same KLYX on every device",
    installText:
      "Use the same account and assistant from your computer or phone.",
  },
  nl: {
    badge: "Eén KLYX-assistent",
    title: "Wat wil je krijgen of verdienen?",
    description:
      "Vraag een dienst, zoek betaalde opdrachten, beheer een bestaande opdracht of stel een vraag. KLYX begrijpt de bedoeling in hetzelfde gesprek.",
    placeholder: "Beschrijf gewoon wat je wilt doen…",
    openAssistant: "KLYX openen",
    examples: [
      "Vind iemand om morgen na 18u mijn kast te monteren.",
      "Ik ben zaterdag vrij en wil ongeveer €100 verdienen in mijn buurt.",
      "Wat is de status van mijn opdracht van morgen?",
    ],
    principleTitle: "Geen klant- of dienstverlenersmodus",
    principleText:
      "Eén account, één geschiedenis en één assistent. Elk bericht bepaalt de nuttige actie zonder kunstmatig profiel te wisselen.",
    install: "Installeren",
    installTitle: "Dezelfde KLYX op al je apparaten",
    installText:
      "Gebruik hetzelfde account en dezelfde assistent op je computer of telefoon.",
  },
  de: {
    badge: "Ein KLYX-Assistent",
    title: "Was möchtest du bekommen oder verdienen?",
    description:
      "Fordere einen Service an, finde bezahlte Aufträge, verwalte einen bestehenden Auftrag oder stelle eine Frage. KLYX versteht die Absicht im selben Gespräch.",
    placeholder: "Beschreibe einfach, was du tun möchtest…",
    openAssistant: "KLYX öffnen",
    examples: [
      "Finde jemanden, der morgen nach 18 Uhr meinen Schrank aufbaut.",
      "Ich bin Samstag frei und möchte in meiner Nähe etwa 100 € verdienen.",
      "Wie ist der Stand meines Auftrags für morgen?",
    ],
    principleTitle: "Kein Kunden- oder Anbietermodus",
    principleText:
      "Ein Konto, ein Verlauf und ein Assistent. Jede Nachricht bestimmt die passende Aktion ohne künstlichen Profilwechsel.",
    install: "Installieren",
    installTitle: "Dasselbe KLYX auf allen Geräten",
    installText:
      "Nutze dasselbe Konto und denselben Assistenten auf Computer oder Smartphone.",
  },
};

export default function PublicHomeContent() {
  const { locale } = useKlyxLocale();
  const copy = COPY[locale] ?? COPY.fr;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <KlyxLogo href="/" />

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/install"
              className="hidden h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <Download size={16} />
              {copy.install}
            </Link>
            <PublicSessionActions compact />
          </nav>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-4xl flex-col justify-center px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2563EB]">
            {copy.badge}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
            {copy.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {copy.description}
          </p>
        </div>

        <div className="mx-auto mt-9 w-full max-w-3xl">
          <div className="rounded-[1.75rem] border border-border bg-card p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-4">
            <div className="flex min-h-20 items-end gap-3 rounded-[1.35rem] bg-background px-4 py-3">
              <p className="min-w-0 flex-1 self-center text-left text-sm text-muted-foreground sm:text-base">
                {copy.placeholder}
              </p>
              <div className="flex shrink-0 items-center gap-1 text-muted-foreground" aria-hidden="true">
                <span className="grid h-9 w-9 place-items-center rounded-full">
                  <Camera size={18} />
                </span>
                <span className="grid h-9 w-9 place-items-center rounded-full">
                  <Mic size={18} />
                </span>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Link
                href="/assistant"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2563EB] px-5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {copy.openAssistant}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-5 space-y-2 px-2 text-left text-sm text-muted-foreground">
            {copy.examples.map((example) => (
              <p key={example}>“{example}”</p>
            ))}
          </div>

          <div className="mt-6">
            <PublicSessionActions />
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/25">
        <div className="mx-auto flex max-w-4xl items-start gap-4 px-5 py-12 sm:px-8">
          <ShieldCheck className="mt-1 shrink-0 text-[#2563EB]" size={22} />
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">
              {copy.principleTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              {copy.principleText}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em]">
            {copy.installTitle}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
            {copy.installText}
          </p>
        </div>
        <InstallKlyxButton />
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-7 text-sm text-muted-foreground sm:px-8">
          <KlyxLogo href="/" />
          <Link href="/assistant" className="font-semibold transition hover:text-foreground">
            {copy.openAssistant}
          </Link>
        </div>
      </footer>
    </main>
  );
}
