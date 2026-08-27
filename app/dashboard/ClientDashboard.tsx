import Link from "next/link";

import DashboardActionCenter from "@/app/components/DashboardActionCenter";

import {
  CalendarDays,
  ChevronRight,
  Heart,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

type Props = {
  firstName: string;
};

const primaryActions = [
  {
    title: "KLYX Assistant",
    description: "Décris ton besoin et laisse KLYX préparer la recherche et la réservation.",
    href: "/assistant/market",
    icon: Sparkles,
  },
  {
    title: "Mon activité",
    description: "Retrouve tes devis, réservations et prestations en cours au même endroit.",
    href: "/bookings",
    icon: CalendarDays,
  },
  {
    title: "Messages",
    description: "Échange avec les prestataires liés à tes demandes et missions.",
    href: "/messages",
    icon: MessageCircle,
  },
  {
    title: "Mon profil",
    description: "Gère ton identité KLYX et les informations visibles sur ton compte.",
    href: "/profile",
    icon: UserRound,
  },
];

const secondaryLinks = [
  {
    label: "Comparer les prestataires",
    href: "/search",
    icon: Search,
  },
  {
    label: "Favoris",
    href: "/favorites",
    icon: Heart,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export default function ClientDashboard({ firstName }: Props) {
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#32135f_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={15} />
            Assistant services KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Bonjour {firstName || "et bienvenue"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Commence par dire ce dont tu as besoin. KLYX organise ensuite le parcours,
            tandis que les fonctions secondaires restent accessibles sans encombrer ton espace.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/assistant/market"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 shadow-lg transition hover:-translate-y-0.5"
            >
              <Sparkles size={17} />
              Organiser mon besoin
            </Link>

            <Link
              href="/bookings"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <CalendarDays size={17} />
              Voir mon activité
            </Link>
          </div>
        </div>
      </section>

      <DashboardActionCenter accountType="client" />

      <section className="mt-8">
        <p className="klyx-eyebrow">Navigation principale</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          L’essentiel, sans surcharge
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Quatre espaces couvrent l’usage quotidien. Les outils moins fréquents sont rangés dessous.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                prefetch
                className="klyx-card klyx-card-hover group flex min-h-52 flex-col p-6"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white dark:text-violet-400">
                  <Icon size={22} />
                </div>
                <h3 className="mt-6 text-lg font-black tracking-[-0.025em]">{action.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {action.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400">
                  Ouvrir <ChevronRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-muted/35 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          Accès secondaires
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
