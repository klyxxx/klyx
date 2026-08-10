import {
  CloudOff,
  ShieldCheck,
} from "lucide-react";

import OfflineRetryButton from "@/app/components/OfflineRetryButton";
import KlyxLogo from "@/app/ui/KlyxLogo";

export const metadata = {
  title: "KLYX hors ligne",
  description:
    "KLYX est temporairement hors ligne sur cet appareil.",
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background dark:bg-[#09090b] px-5 py-10 text-foreground dark:text-white">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-10">
        <KlyxLogo href="/" />

        <div className="mt-10 grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/12 text-violet-300">
          <CloudOff size={30} />
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-violet-300">
          Connexion indisponible
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">
          KLYX est temporairement hors ligne.
        </h1>

        <p className="mt-5 text-sm leading-7 text-white/55">
          Vérifie ta connexion Internet puis réessaie.
          Les paiements, réservations, messages et données
          personnelles ne sont jamais servis depuis un cache
          hors ligne.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
          <ShieldCheck
            size={19}
            className="mt-0.5 shrink-0 text-emerald-400"
          />
          <p className="text-sm leading-6 text-white/55">
            KLYX garde seulement les ressources visuelles
            nécessaires à l’application. Les opérations
            sensibles restent connectées aux serveurs KLYX.
          </p>
        </div>

        <div className="mt-7">
          <OfflineRetryButton />
        </div>
      </section>
    </main>
  );
}
