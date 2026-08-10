import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Globe2,
  Laptop,
  LogIn,
  Share2,
  Smartphone,
} from "lucide-react";

import InstallKlyxButton from "@/app/components/InstallKlyxButton";
import KlyxLogo from "@/app/ui/KlyxLogo";

export const metadata = {
  title: "Installer KLYX",
  description:
    "Installe KLYX sur ton téléphone, ta tablette ou ton ordinateur.",
};

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-background dark:bg-[#09090b] text-foreground dark:text-white">
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <KlyxLogo href="/" />

          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold transition hover:bg-white/7"
          >
            <LogIn size={17} />
            Se connecter
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-white/45 transition hover:text-foreground dark:text-white"
        >
          <ArrowLeft size={17} />
          Retour à l’accueil
        </Link>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_55%,#111827_100%)] p-7 shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
              <Download size={15} />
              Installer KLYX
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              KLYX directement sur ton appareil.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/65">
              KLYX fonctionne déjà dans ton navigateur. L’installation est
              facultative : elle ajoute une icône KLYX et permet une ouverture
              plus proche d’une application classique.
            </p>

            <div className="mt-7">
              <InstallKlyxButton />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <InfoCard
            icon={<Smartphone size={22} />}
            title="Android"
            description="Sur Chrome ou Edge compatible, utilise le bouton Installer KLYX quand il apparaît."
          />

          <InfoCard
            icon={<Share2 size={22} />}
            title="iPhone / iPad"
            description="Dans Safari : Partager → Sur l’écran d’accueil → Ajouter."
          />

          <InfoCard
            icon={<Laptop size={22} />}
            title="Ordinateur"
            description="Chrome ou Edge peut installer KLYX dans une fenêtre dédiée avec son icône."
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Ce que tu obtiens
            </p>

            <div className="mt-5 space-y-4">
              <CheckLine text="Une icône KLYX sur ton appareil" />
              <CheckLine text="Une ouverture en mode application quand le navigateur le permet" />
              <CheckLine text="Le même compte et les mêmes données que sur le site" />
              <CheckLine text="Aucun App Store ou Play Store nécessaire pour cette version" />
            </div>
          </article>

          <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6 sm:p-8">
            <Globe2 size={26} className="text-violet-300" />

            <h2 className="mt-5 text-2xl font-black">
              Pas envie d’installer ?
            </h2>

            <p className="mt-3 text-sm leading-7 text-white/48">
              Aucun problème. KLYX reste entièrement accessible depuis le
              navigateur sur téléphone, tablette et ordinateur.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black transition hover:bg-violet-500"
              >
                Se connecter
              </Link>

              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-black transition hover:bg-white/7"
              >
                Créer un compte
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <p className="font-black">Version actuelle</p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Cette version est une application web installable (PWA). Ce n’est
            pas encore une application publiée sur l’App Store ou Google Play.
            Les applications magasin viendront après la stabilisation de KLYX.
          </p>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-300">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/45">
        {description}
      </p>
    </article>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2
        size={18}
        className="mt-0.5 shrink-0 text-emerald-400"
      />
      <p className="text-sm leading-6 text-white/62">{text}</p>
    </div>
  );
}
