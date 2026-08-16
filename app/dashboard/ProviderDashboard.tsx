import Link from "next/link";

import DashboardActionCenter from "@/app/components/DashboardActionCenter";
import ProviderActivitySnapshot from "./ProviderActivitySnapshot";

import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  ListPlus,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";

type Props = {
  firstName: string;
};

// KLYX_PROVIDER_DASHBOARD_WORKFLOW_13_82
const actions = [
  {
    title:
      "Opportunités KLYX",

    description:
      "Découvre les missions compatibles avec tes services, ta zone et tes disponibilités.",

    href:
      "/provider/jobs",

    icon:
      Search,

    featured:
      true,
  },

  {
    title:
      "Assistant Prestataire",

    description:
      "Prépare tes réponses, devis et disponibilités avec KLYX avant toute action.",

    href:
      "/provider/assistant",

    icon:
      Sparkles,

    featured:
      true,
  },

  {
    title:
      "Réservations & missions",

    description:
      "Suis les prestations acceptées, planifiées, en cours et terminées.",

    href:
      "/bookings",

    icon:
      CalendarDays,
  },

  {
    title:
      "Demandes de devis",

    description:
      "Consulte les demandes de prix, ajuste ton montant et envoie tes devis.",

    href:
      "/provider/quotes",

    icon:
      FileText,
  },

  {
    title:
      "Tableau professionnel",

    description:
      "Gère tes services, tes zones, tes prix et ta présentation publique.",

    href:
      "/provider",

    icon:
      BriefcaseBusiness,
  },

  {
    title:
      "Messagerie clients",

    description:
      "Échange avec les clients depuis ton espace professionnel.",

    href:
      "/messages",

    icon:
      MessageCircle,
  },

  {
    title:
      "Ajouter un métier",

    description:
      "Propose un nouveau service et configure son prix et sa zone.",

    href:
      "/provider/services/new",

    icon:
      ListPlus,
  },

  {
    title:
      "Paiements",

    description:
      "Configure Stripe, vérifie ton identité et consulte ton statut.",

    href:
      "/provider/payments",

    icon:
      Banknote,
  },

  {
    title:
      "Score et avis",

    description:
      "Suis ta réputation, tes missions réalisées et ton score KLYX.",

    href:
      "/scores",

    icon:
      Star,
  },

  {
    title:
      "Profil public",

    description:
      "Améliore ta photo, ton titre et tes informations professionnelles.",

    href:
      "/profile",

    icon:
      UserRound,
  },
];

export default function ProviderDashboard({
  firstName,
}: Props) {
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827_0%,#18233f_48%,#0f172a_100%)] p-7 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <ShieldCheck size={15} />
            Espace prestataire
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Bonjour {firstName || "professionnel"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            KLYX t’aide à repérer les bonnes missions,
            préparer ta réponse puis suivre ton travail.
            Rien n’est envoyé ou accepté sans ton action.
          </p>

          {/* KLYX_PROVIDER_PRIMARY_WORKFLOW_13_82 */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/provider/jobs"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 shadow-lg transition hover:-translate-y-0.5"
            >
              <Search size={17} />
              Voir mes opportunités
            </Link>

            <Link
              href="/provider/assistant"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <Sparkles size={17} />
              Assistant KLYX
            </Link>

            <Link
              href="/bookings"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <CalendarDays size={17} />
              Mes missions
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <WorkflowStep
              number="1"
              title="Trouve une mission"
              description="KLYX affiche les opportunités compatibles."
            />

            <WorkflowStep
              number="2"
              title="Prépare ta réponse"
              description="L’assistant t’aide sans rien envoyer seul."
            />

            <WorkflowStep
              number="3"
              title="Suis la prestation"
              description="La réservation reste visible jusqu’à la fin."
            />
          </div>
        </div>
      </section>

      <DashboardActionCenter
        accountType="provider"
      />

      {/* KLYX_PROVIDER_ACTIVITY_DASHBOARD_13_02 */}
      <ProviderActivitySnapshot />

      <section className="mt-8">
        <p className="klyx-eyebrow">
          Ton activité professionnelle
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          Tout ton travail au même endroit
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Commence par les opportunités KLYX ou utilise
          l’assistant pour préparer une réponse. Les devis,
          réservations, messages, paiements et avis restent
          accessibles depuis le même espace.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                    `klyx-card klyx-card-hover group relative flex min-h-56 flex-col overflow-hidden p-6 ${
                      action.featured
                        ? "border-blue-500/30 bg-blue-500/[0.05]"
                        : ""
                    }`
                  }
                >
                  <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-blue-500/[0.05] blur-2xl transition group-hover:bg-blue-500/10" />

                  <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-blue-500/10 bg-blue-500/10 text-blue-600 shadow-sm transition group-hover:-translate-y-0.5 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                    <Icon size={22} />
                  </div>

                  <h3 className="relative mt-6 text-lg font-black tracking-[-0.025em]">
                    {action.title}
                  </h3>

                  <p className="relative mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </p>

                  <span className="relative mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400">
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

      {/* KLYX_PROVIDER_CONTROL_REMINDER_13_82 */}
      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">
            Opportunités
          </p>

          <h2 className="mt-2 text-2xl font-black">
            KLYX t’aide à choisir où répondre
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Les missions compatibles sont comparées pour
            t’aider à identifier les plus pertinentes.
            Tu décides toujours si tu souhaites répondre
            et quel prix proposer.
          </p>
        </div>

        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">
            Assistant
          </p>

          <h2 className="mt-2 text-2xl font-black">
            KLYX prépare, tu confirmes
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            L’assistant peut préparer un devis, une réponse
            ou une disponibilité, mais aucune offre,
            réservation ou action n’est envoyée automatiquement.
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