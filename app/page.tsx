import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarCheck2,
  Camera,
  CheckCircle2,
  Download,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import InstallKlyxButton from "@/app/components/InstallKlyxButton";
import KlyxLogo from "@/app/ui/KlyxLogo";
import PublicSessionActions from "@/app/components/PublicSessionActions";

const services = [
  "Baby-sitting",
  "Ménage",
  "Déménagement",
  "Bricolage",
];

const highlights = [
  {
    icon: Bot,
    title: "Un assistant qui agit",
    description:
      "KLYX t’aide à trouver, organiser et suivre les services dont tu as besoin.",
  },
  {
    icon: Search,
    title: "Des prestataires adaptés",
    description:
      "Recherche par besoin, zone, disponibilité et critères de confiance.",
  },
  {
    icon: CalendarCheck2,
    title: "Réservation centralisée",
    description:
      "Devis, réservation, messages, suivi et paiement dans une même expérience.",
  },
  {
    icon: ShieldCheck,
    title: "Confiance intégrée",
    description:
      "Vérifications, preuves de compétences, avis et règles de sécurité KLYX.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background dark:bg-[#09090b] text-foreground dark:text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-background dark:bg-[#09090b]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <KlyxLogo href="/" />

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/install"
              className="hidden h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Download size={16} />
              Installer
            </Link>

            <PublicSessionActions compact />
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.28),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.18),transparent_24%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:pb-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-200">
              <Sparkles size={16} />
              Un service pour chaque besoin
            </div>

            <h1 className="mt-7 max-w-5xl text-5xl font-black leading-[0.96] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
              KLYX organise les services du quotidien à ta place.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/58 sm:text-xl">
              Trouve un prestataire, demande un devis, réserve, échange,
              paie et suis ta mission depuis une seule plateforme.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PublicSessionActions />

              <Link
                href="/install"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/12 px-6 text-base font-bold text-white/80 transition hover:bg-white/7 hover:text-white sm:hidden"
              >
                <Download size={19} />
                Installer KLYX
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/48">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Compte gratuit
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Utilisable dans le navigateur
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Installable sur appareil compatible
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-violet-600/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between border-b border-white/8 pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                    KLYX Assistant
                  </p>
                  <p className="mt-1 text-lg font-black">
                    De quoi as-tu besoin ?
                  </p>
                </div>

                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Bot size={22} />
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/8 bg-black/25 p-5">
                <p className="text-sm leading-7 text-white/72">
                  « J’ai besoin de quelqu’un pour nettoyer mon appartement
                  samedi matin à Bruxelles. »
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <ResultRow
                  icon={<Search size={18} />}
                  title="Recherche"
                  text="Prestataires compatibles avec ton besoin"
                />
                <ResultRow
                  icon={<BadgeCheck size={18} />}
                  title="Confiance"
                  text="Compétences et profils contrôlés"
                />
                <ResultRow
                  icon={<CalendarCheck2 size={18} />}
                  title="Réservation"
                  text="Créneau, devis et mission centralisés"
                />
              </div>

              <div className="mt-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5">
                <div className="flex items-center gap-3">
                  <Star size={20} />
                  <div>
                    <p className="font-black">
                      Une expérience unique
                    </p>
                    <p className="mt-1 text-sm text-white/75">
                      Client et prestataire dans le même écosystème KLYX.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-white/35">
            Services de lancement
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {services.map((service) => (
              <span
                key={service}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-400">
            Une seule plateforme
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Moins d’applications. Moins de recherches. Plus d’action.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-300">
                  <Icon size={22} />
                </span>

                <h3 className="mt-5 text-xl font-black">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/48">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#2b1452_50%,#111827)] p-7 sm:p-10 lg:grid-cols-[1fr_0.75fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
              KLYX sur ton appareil
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              Utilise KLYX dans le navigateur ou installe-le comme une application.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              Aucun téléchargement obligatoire. Sur les appareils compatibles,
              KLYX peut être ajouté à ton écran d’accueil et s’ouvrir en mode application.
            </p>

            <Link
              href="/install"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 text-sm font-black transition hover:bg-white/14"
            >
              <Download size={18} />
              Voir les options d’installation
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <InstallKlyxButton />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <KlyxLogo href="/" />
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="hover:text-foreground dark:text-white">
              Connexion
            </Link>
            <Link href="/signup" className="hover:text-foreground dark:text-white">
              Créer un compte
            </Link>
            <Link href="/install" className="hover:text-foreground dark:text-white">
              Installer KLYX
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ResultRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/7 text-violet-300">
        {icon}
      </span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/42">{text}</p>
      </div>
    </div>
  );
}

