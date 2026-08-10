"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ScoresPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function recalculateScores() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/scores/recalculate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = (await response.json()) as {
        updated?: number;
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Recalcul impossible."
        );
      }

      setMessage(
        `${result.updated ?? 0} profil(s) mis à jour.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-5 py-10 text-foreground dark:text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:text-white"
        >
          Retour au tableau de bord
        </Link>

        <section className="mt-10 rounded-3xl border border-border dark:border-zinc-800 bg-card/70 dark:bg-zinc-900/70 p-6 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
            <ShieldCheck size={28} />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            KLYX Score
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Fiabilité des prestataires
          </h1>

          <p className="mt-4 text-muted-foreground dark:text-zinc-400">
            Le score KLYX v1 utilise les prestations
            terminées, le taux d’annulation et
            l’historique d’activité.
          </p>

          {message && (
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={recalculateScores}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            <RefreshCw
              size={20}
              className={
                loading ? "animate-spin" : ""
              }
            />

            {loading
              ? "Calcul en cours..."
              : "Recalculer les scores"}
          </button>
        </section>
      </div>
    </main>
  );
}