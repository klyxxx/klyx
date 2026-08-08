import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

const FEATURES = [
  "Création de compte réelle",
  "Profil Client ou Prestataire",
  "Réservations et devis KLYX",
  "Installation sur téléphone ou ordinateur",
];

export default function BetaPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-2xl font-black tracking-[-0.05em]"
          >
            KLYX
          </Link>

          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black transition hover:bg-white/[0.08]"
          >
            <LogIn size={17} />
            Se connecter
          </Link>
        </header>

        <section className="relative mt-10 overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#32135f_50%,#101827_100%)] p-7 shadow-2xl sm:p-10 lg:p-14">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-violet-100">
              <Sparkles size={15} />
              Beta KLYX
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
              Testez KLYX avec un vrai compte.
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
              Créez votre espace, choisissez votre rôle et utilisez
              KLYX depuis votre téléphone ou votre ordinateur.
              Cette version est encore en phase Beta.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Link
                href="/signup?type=client"
                className="group rounded-3xl border border-white/10 bg-white p-6 text-zinc-950 transition hover:-translate-y-0.5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                  <UserRound size={23} />
                </span>

                <h2 className="mt-5 text-2xl font-black">
                  Je suis client
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Je cherche, compare et réserve des services.
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-violet-700">
                  Créer mon compte
                  <ArrowRight
                    size={17}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>

              <Link
                href="/signup?type=provider"
                className="group rounded-3xl border border-blue-400/20 bg-blue-500/10 p-6 transition hover:-translate-y-0.5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-400/15 text-blue-200">
                  <BriefcaseBusiness size={23} />
                </span>

                <h2 className="mt-5 text-2xl font-black">
                  Je suis prestataire
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  Je propose mes compétences et construis mon activité KLYX.
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-blue-200">
                  Créer mon espace
                  <ArrowRight
                    size={17}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Ce que vous pouvez tester
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <CheckCircle2
                    size={18}
                    className="shrink-0 text-emerald-400"
                  />
                  <span className="text-sm font-bold text-white/75">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-400/10 p-4">
              <div className="flex gap-3">
                <ShieldCheck
                  size={20}
                  className="shrink-0 text-amber-300"
                />
                <p className="text-sm leading-6 text-white/65">
                  Certaines vérifications externes prestataires peuvent
                  rester en attente pendant la Beta. KLYX ne les présente
                  pas comme validées tant qu’elles ne le sont pas réellement.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <Download
              size={25}
              className="text-violet-300"
            />

            <h2 className="mt-5 text-2xl font-black">
              Installer KLYX
            </h2>

            <p className="mt-3 text-sm leading-7 text-white/55">
              KLYX peut être installé comme application sur un appareil
              compatible sans passer par un store.
            </p>

            <Link
              href="/install"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950"
            >
              Voir l’installation
              <ArrowRight size={17} />
            </Link>
          </article>
        </section>

        <footer className="py-10 text-center text-xs text-white/35">
          KLYX Beta · Test en conditions réelles
        </footer>
      </div>
    </main>
  );
}
