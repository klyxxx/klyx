import Link from "next/link";
import { ArrowLeft, CheckCircle2, Globe2, Smartphone } from "lucide-react";
import InstallKlyxButton from "@/app/components/InstallKlyxButton";

export const metadata = {
  title: "Installer KLYX",
  description: "Installe KLYX sur ton téléphone, ta tablette ou ton ordinateur.",
};

export default function InstallPage() {
  return (
    <main className="klyx-page">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={17} />
        Retour
      </Link>

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_55%,#111827_100%)] p-7 text-white shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            <Smartphone size={15} />
            Application KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            KLYX directement sur ton écran
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Installe KLYX comme une application pour l’ouvrir rapidement,
            profiter d’un affichage plein écran et retrouver la même expérience
            sur téléphone, tablette et ordinateur.
          </p>

          <div className="mt-7">
            <InstallKlyxButton />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <InfoCard
          icon={<Smartphone size={22} />}
          title="Écran d’accueil"
          description="Une icône KLYX apparaît avec tes autres applications."
        />
        <InfoCard
          icon={<Globe2 size={22} />}
          title="Toujours synchronisé"
          description="Les données restent liées à ton compte Supabase en ligne."
        />
        <InfoCard
          icon={<CheckCircle2 size={22} />}
          title="Sans magasin"
          description="La version web installable ne nécessite pas encore App Store ou Play Store."
        />
      </section>

      <section className="klyx-card mt-8 p-6 sm:p-8">
        <p className="klyx-eyebrow">Important</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
          Version installable et version magasin
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Cette installation transforme le site public KLYX en application web
          installable. Une publication officielle sur l’App Store et Google Play
          nécessitera ensuite une application mobile empaquetée, des comptes
          développeur, des tests, des captures, une politique de confidentialité
          et la validation de chaque magasin.
        </p>
      </section>
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
    <article className="klyx-card p-6">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
