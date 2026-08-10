import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck2, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-24 pt-24 sm:px-8 sm:pb-32 sm:pt-32">
      <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-[520px] max-w-5xl rounded-full bg-violet-600/20 blur-[130px]" />

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200">
            <Sparkles className="h-4 w-4" />
            L’assistant qui organise vos services du quotidien
          </div>

          <h1 className="text-balance text-5xl font-black tracking-[-0.055em] text-foreground dark:text-white sm:text-7xl lg:text-8xl">
            Un besoin. Le bon prestataire. Tout est organisé.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground dark:text-zinc-400 sm:text-xl">
            Recherchez, comparez, réservez et payez des professionnels fiables depuis une seule plateforme.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-bold text-zinc-950 transition hover:-translate-y-0.5 hover:bg-zinc-200">
              Commencer gratuitement
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/search" className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-bold text-white transition hover:bg-white/10">
              Explorer les services
            </Link>
          </div>
        </div>

        <div id="trust" className="mx-auto mt-16 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            [BadgeCheck, "Profils vérifiables"],
            [CalendarCheck2, "Réservation simplifiée"],
            [Sparkles, "Assistance intelligente"],
          ].map(([Icon, label]) => {
            const Component = Icon as typeof BadgeCheck;
            return (
              <div key={String(label)} className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-sm font-semibold text-foreground/80 dark:text-zinc-300">
                <Component className="h-5 w-5 text-violet-400" />
                {String(label)}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
