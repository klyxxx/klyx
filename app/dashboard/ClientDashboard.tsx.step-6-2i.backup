import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  MessageCircle,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

type Props = {
  firstName: string;
};

const actions = [
  {
    title: "Assistant KLYX",
    description:
      "Décris ton besoin. KLYX comprend, cherche et prépare la réservation.",
    href: "/brain",
    icon: Sparkles,
    featured: true,
  },
  {
    title: "Trouver un service",
    description:
      "Compare les prestataires disponibles selon le prix, la ville et la confiance.",
    href: "/search",
    icon: Search,
  },
  {
    title: "Mes réservations",
    description:
      "Retrouve tes demandes, paiements, annulations et missions en cours.",
    href: "/bookings",
    icon: CalendarDays,
  },
  {
    title: "Messages",
    description:
      "Échange avec tes prestataires avant et pendant la mission.",
    href: "/messages",
    icon: MessageCircle,
  },
  {
    title: "Favoris",
    description:
      "Conserve les prestataires que tu souhaites retrouver rapidement.",
    href: "/favorites",
    icon: Heart,
  },
  {
    title: "Mon profil",
    description:
      "Gère tes informations personnelles et ton compte KLYX.",
    href: "/profile",
    icon: UserRound,
  },
];

export default function ClientDashboard({ firstName }: Props) {
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#32135f_52%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={15} />
            Espace client
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Bonjour {firstName || "et bienvenue"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Décris ton besoin à KLYX. L’assistant trouve les meilleurs
            prestataires et prépare tout avant ta confirmation.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/brain"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 shadow-lg transition hover:-translate-y-0.5"
            >
              Parler à KLYX
              <ArrowRight size={17} />
            </Link>

            <Link
              href="/search"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              Rechercher moi-même
              <Search size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <p className="klyx-eyebrow">Ton espace personnel</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          Organise tous tes services
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className={`klyx-card klyx-card-hover group flex min-h-56 flex-col p-6 ${
                  action.featured
                    ? "border-violet-500/30 bg-violet-500/[0.05]"
                    : ""
                }`}
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
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">Simple</p>
          <h2 className="mt-2 text-2xl font-black">
            Tu gardes toujours le contrôle
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            KLYX peut rechercher et préparer une réservation, mais aucune
            réservation ni aucun paiement n’est effectué sans ta validation.
          </p>
        </div>

        <div className="klyx-card p-6 sm:p-8">
          <p className="klyx-eyebrow">Professionnel</p>
          <h2 className="mt-2 text-2xl font-black">
            Ton activité reste séparée
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Ton profil client ne mélange jamais tes demandes personnelles avec
            ton éventuelle activité de prestataire.
          </p>
        </div>
      </section>
    </>
  );
}
