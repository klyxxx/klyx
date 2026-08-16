import Link from "next/link";

import DashboardActionCenter from "@/app/components/DashboardActionCenter";

import {
  ArrowRight,
  CalendarDays,
  Heart,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

type Props = {
  firstName: string;
};

// KLYX_CLIENT_DASHBOARD_WORKFLOW_13_83
const actions = [
  {
    title:
      "Organiser avec KLYX",

    description:
      "Décris ton besoin. KLYX le structure, prépare la recherche et attend ta confirmation avant publication.",

    href:
      "/assistant/market",

    icon:
      Sparkles,

    featured:
      true,
  },

  {
    title:
      "Comparer les prestataires",

    description:
      "Recherche et compare les profils selon le prix, la confiance, les avis et leur compatibilité.",

    href:
      "/search",

    icon:
      Search,

    featured:
      true,
  },

  {
    title:
      "Mes réservations",

    description:
      "Retrouve les prochaines étapes, confirmations, paiements et prestations en cours.",

    href:
      "/bookings",

    icon:
      CalendarDays,
  },

  {
    title:
      "Messages",

    description:
      "Échange avec tes prestataires avant et pendant la mission.",

    href:
      "/messages",

    icon:
      MessageCircle,
  },

  {
    title:
      "Favoris",

    description:
      "Conserve les prestataires que tu souhaites retrouver rapidement.",

    href:
      "/favorites",

    icon:
      Heart,
  },

  {
    title:
      "Mon profil",

    description:
      "Gère tes informations personnelles et ton compte KLYX.",

    href:
      "/profile",

    icon:
      UserRound,
  },
];

export default function ClientDashboard({
  firstName,
}: Props) {
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
            Dis simplement ce dont tu as besoin.
            KLYX peut organiser la recherche, comparer
            les solutions et préparer la réservation,
            tout en te demandant confirmation aux étapes importantes.
          </p>

          {/* KLYX_CLIENT_PRIMARY_WORKFLOW_13_83 */}
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
              href="/search"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <Search size={17} />
              Comparer moi-même
            </Link>

            <Link
              href="/bookings"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <CalendarDays size={17} />
              Suivre mes missions
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <WorkflowStep
              number="1"
              title="Décris ton besoin"
              description="KLYX comprend et prépare la demande."
            />

            <WorkflowStep
              number="2"
              title="Compare les solutions"
              description="KLYX explique les profils qui ressortent."
            />

            <WorkflowStep
              number="3"
              title="Confirme puis suis"
              description="Tu gardes la décision avant réservation et paiement."
            />
          </div>
        </div>
      </section>

      <DashboardActionCenter
        accountType="client"
      />

      <section className="mt-8">
        <p className="klyx-eyebrow">
          Ton espace personnel
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          Un service pour chaque besoin
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Commence avec l’assistant KLYX si tu veux être guidé,
          ou ouvre directement la recherche pour comparer toi-même.
          Tes réservations restent ensuite suivies au même endroit.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {actions.map(
            (
              action
            ) => {
              const Icon =
                action.icon;

              return (
                <Link
                  key={
                    action.href
                  }
                  href={
                    action.href
                  }
                  prefetch
                  className={
                    `klyx-card klyx-card-hover group flex min-h-56 flex-col p-6 ${
                      action.featured
                        ? "border-violet-500/30 bg-violet-500/[0.05]"
                        : ""
                    }`
                  }
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white dark:text-violet-400">
                    <Icon size={22} />
                  </div>

                  <h3 className="mt-6 text-lg font-black tracking-[-0.025em]">
                    {action.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400">
                    Ouvrir

                    <ArrowRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              );
            }
          )}
        </div>
      </section>

      {/* KLYX_CLIENT_CONTROL_REMINDER_13_83 */}
      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">
            Assistant
          </p>

          <h2 className="mt-2 text-2xl font-black">
            KLYX organise, tu décides
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            KLYX peut comprendre ton besoin, préparer sa publication,
            comparer les offres et recommander une solution.
            Le choix final reste toujours le tien.
          </p>
        </div>

        <div className="klyx-card p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={17}
              className="text-violet-600"
            />

            <p className="klyx-eyebrow">
              Contrôle
            </p>
          </div>

          <h2 className="mt-2 text-2xl font-black">
            Aucun paiement sans confirmation
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            La publication d’une demande, le choix d’un prestataire,
            la réservation et le paiement nécessitent toujours
            une action explicite de ta part.
          </p>
        </div>
      </section>
    </>
  );
}

function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-zinc-950">
          {number}
        </span>

        <p className="font-black">
          {title}
        </p>
      </div>

      <p className="mt-2 text-xs leading-5 text-white/60">
        {description}
      </p>
    </div>
  );
}