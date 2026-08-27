import Link from "next/link";

import DashboardActionCenter from "@/app/components/DashboardActionCenter";
import ProviderActivitySnapshot from "./ProviderActivitySnapshot";

import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FileText,
  ListPlus,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";

type Props = {
  firstName: string;
};

const primaryActions = [
  {
    title: "Missions",
    description: "Découvre les opportunités compatibles et suis les prestations déjà engagées.",
    href: "/provider/jobs",
    icon: Search,
  },
  {
    title: "Services",
    description: "Gère tes métiers, tarifs, zones, disponibilités et présentation professionnelle.",
    href: "/provider",
    icon: BriefcaseBusiness,
  },
  {
    title: "Finances",
    description: "Retrouve ton statut de paiement, tes versements et la configuration bancaire.",
    href: "/provider/payments",
    icon: Banknote,
  },
  {
    title: "Messages",
    description: "Échange avec les clients liés à tes demandes, devis et missions.",
    href: "/messages",
    icon: MessageCircle,
  },
  {
    title: "Mon profil",
    description: "Gère ton identité, ta réputation et les informations de ton profil public.",
    href: "/profile",
    icon: UserRound,
  },
];

const secondaryLinks = [
  {
    label: "Assistant prestataire",
    href: "/provider/assistant",
    icon: Sparkles,
  },
  {
    label: "Demandes de devis",
    href: "/provider/quotes",
    icon: FileText,
  },
  {
    label: "Réservations",
    href: "/bookings",
    icon: CalendarDays,
  },
  {
    label: "Ajouter un métier",
    href: "/provider/services/new",
    icon: ListPlus,
  },
  {
    label: "Score et avis",
    href: "/scores",
    icon: Star,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export default function ProviderDashboard({ firstName }: Props) {
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827_0%,#18233f_48%,#0f172a_100%)] p-7 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <BriefcaseBusiness size={15} />
            Espace prestataire
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Bonjour {firstName || "professionnel"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Ton espace est maintenant centré sur les missions, les services et les finances.
            Les outils occasionnels restent disponibles sans concurrencer le travail quotidien.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/provider/jobs"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 shadow-lg transition hover:-translate-y-0.5"
            >
              <Search size={17} />
              Voir mes missions
            </Link>

            <Link
              href="/provider"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <BriefcaseBusiness size={17} />
              Gérer mes services
            </Link>

            <Link
              href="/provider/payments"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <Banknote size={17} />
              Finances
            </Link>
          </div>
        </div>
      </section>

      <DashboardActionCenter accountType="provider" />
      <ProviderActivitySnapshot />

      <section className="mt-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          Navigation principale
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          Ton activité, classée par fonction
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Les cinq espaces principaux couvrent l’activité récurrente. Les réglages et outils ponctuels sont rangés séparément.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                prefetch
                className="klyx-card klyx-card-hover group flex min-h-52 flex-col p-6"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                  <Icon size={22} />
                </div>
                <h3 className="mt-6 text-lg font-black tracking-[-0.025em]">{action.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {action.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400">
                  Ouvrir <ChevronRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-muted/35 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          Outils secondaires
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {secondaryLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground transition hover:bg-muted"
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
