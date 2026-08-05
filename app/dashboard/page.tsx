import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveProfile } from "@/lib/active-profile";
import AccountSwitcher from "@/app/components/AccountSwitcher";
import Header from "./Header";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getActiveProfile();

  if (!profile) {
    redirect("/profile");
  }

  const isProvider = profile.accountType === "provider";

  const fullName =
    `${profile.firstName} ${profile.lastName}`.trim() ||
    user.email ||
    "Utilisateur";

  const actions = isProvider
    ? [
        {
          title: "Espace prestataire",
          description:
            "Gère tes services, tes tarifs, tes zones et ta disponibilité.",
          href: "/provider",
          icon: BriefcaseBusiness,
        },
        {
          title: "Demandes reçues",
          description:
            "Consulte les réservations et réponds rapidement aux clients.",
          href: "/bookings",
          icon: CalendarDays,
        },
        {
          title: "Messages",
          description:
            "Discute avec tes clients depuis une messagerie centralisée.",
          href: "/messages",
          icon: MessageCircle,
        },
        {
          title: "Mon profil public",
          description:
            "Améliore ta présentation, ta photo et tes informations.",
          href: "/profile",
          icon: UserRound,
        },
      ]
    : [
        {
          title: "Trouver un service",
          description:
            "Recherche un prestataire fiable pour ton besoin du quotidien.",
          href: "/search",
          icon: Search,
        },
        {
          title: "Assistant KLYX",
          description:
            "Explique ton besoin et laisse KLYX organiser les prochaines étapes.",
          href: "/brain",
          icon: Sparkles,
        },
        {
          title: "Mes réservations",
          description:
            "Suis toutes tes demandes, confirmations et interventions.",
          href: "/bookings",
          icon: CalendarDays,
        },
        {
          title: "Devenir prestataire",
          description:
            "Crée un profil professionnel séparé et commence à proposer tes services.",
          href: "/accounts",
          icon: UserPlus,
        },
      ];

  return (
    <main className="klyx-page">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <Header email={user.email ?? ""} displayName={fullName} />
        <AccountSwitcher currentProfileId={profile.id} />
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#24133f_48%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            <ShieldCheck size={15} />
            {isProvider ? "Espace prestataire" : "Espace client"}
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Bonjour {profile.firstName || "et bienvenue"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
            {isProvider
              ? "Pilote ton activité, réponds aux demandes et développe ta réputation depuis un seul espace."
              : "Recherche, réserve et organise tous tes services du quotidien depuis une seule application."}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={isProvider ? "/provider" : "/search"}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-zinc-950 shadow-lg transition hover:-translate-y-0.5"
            >
              {isProvider ? "Ouvrir mon espace" : "Trouver un service"}
              <ArrowRight size={17} />
            </Link>

            <Link
              href="/brain"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-bold text-white transition hover:bg-white/12"
            >
              <Sparkles size={17} />
              Parler à KLYX
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5">
          <p className="klyx-eyebrow">Accès rapides</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-foreground sm:text-3xl">
            Tout ce dont tu as besoin
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <DashboardCard key={action.href + action.title} {...action} />
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">KLYX évolue avec toi</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
            Un compte, plusieurs profils
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Tu peux conserver un profil client et créer séparément un profil
            prestataire. Cela évite de mélanger tes réservations personnelles
            avec ton activité professionnelle.
          </p>

          <Link
            href="/accounts"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-600 dark:text-violet-400"
          >
            Gérer mes profils
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">Confiance</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
            Ton activité au même endroit
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Réservations, messages, notifications, profils et paiements sont
            organisés dans une expérience unique.
          </p>
        </div>
      </section>
    </main>
  );
}

type DashboardCardProps = {
  title: string;
  description: string;
  href: string;
  icon: typeof Search;
};

function DashboardCard({
  title,
  description,
  href,
  icon: Icon,
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="klyx-card klyx-card-hover group flex min-h-56 flex-col p-6"
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white dark:text-violet-400">
        <Icon size={22} />
      </div>

      <h3 className="mt-6 text-lg font-black tracking-[-0.025em]">{title}</h3>

      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-600 dark:text-violet-400">
        Ouvrir
        <ArrowRight
          size={16}
          className="transition group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
}
