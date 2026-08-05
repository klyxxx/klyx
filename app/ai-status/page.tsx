import Link from "next/link";
import { ArrowLeft, Bot, CheckCircle2, ShieldCheck } from "lucide-react";
import { isKlyxAiEnabled } from "@/lib/klyx-ai";

export const dynamic = "force-dynamic";

export default function AiStatusPage() {
  const enabled = isKlyxAiEnabled();

  return (
    <main className="klyx-page">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
      >
        <ArrowLeft size={17} />
        Tableau de bord
      </Link>

      <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#30135c_52%,#111827)] p-8 text-white">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]">
          <Bot size={15} />
          Fondation IA KLYX
        </div>

        <h1 className="mt-5 text-3xl font-black sm:text-5xl">
          Assistant intelligent, activation progressive
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
          KLYX conserve son assistant gratuit actuel. Lorsqu’une clé API sera
          ajoutée plus tard, le moteur intelligent s’activera automatiquement
          sans reconstruire toute l’application.
        </p>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="klyx-card p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2
              className={
                enabled ? "text-emerald-500" : "text-amber-500"
              }
            />
            <h2 className="text-xl font-black">
              {enabled ? "IA OpenAI activée" : "Mode gratuit activé"}
            </h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {enabled
              ? "Les réponses peuvent utiliser le modèle configuré côté serveur."
              : "Aucun crédit n’est consommé. KLYX utilise ses règles locales de secours."}
          </p>
        </article>

        <article className="klyx-card p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-violet-600" />
            <h2 className="text-xl font-black">Sécurité conservée</h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            L’IA ne peut pas confirmer seule un paiement, un remboursement,
            une réservation ou une activité réglementée.
          </p>
        </article>
      </section>
    </main>
  );
}
