"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ShieldCheck,
  Star,
  CheckCircle2,
  Ban,
  BriefcaseBusiness,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScoreResponse = {
  updated?: number;
  completedJobs?: number;
  cancelledJobs?: number;
  totalJobs?: number;
  cancellationRate?: number;
  averageRating?: number;
  reviewCount?: number;
  klyxScore?: number;
  message?: string;
  error?: string;
};

export default function ScoresPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [result, setResult] =
    useState<ScoreResponse | null>(null);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function recalculateScores() {
    setLoading(true);
    setResult(null);
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
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const body =
        (await response.json()) as ScoreResponse;

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Recalcul impossible."
        );
      }

      setResult(body);
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
    <main className="min-h-screen bg-background px-4 py-6 text-foreground dark:bg-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          Retour au tableau de bord
        </Link>

        <section className="mt-7 rounded-3xl border border-border bg-card p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ShieldCheck size={28} />
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
            KLYX Score v2
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            Ta fiabilité professionnelle
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Le score fonctionne désormais pour tous les
            métiers KLYX. Il combine activité, missions
            terminées, annulations et avis vérifiés.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <ScoreRule
              icon={<BriefcaseBusiness size={18} />}
              title="Activité"
              description="Jusqu’à 20 points selon les missions terminées."
            />
            <ScoreRule
              icon={<CheckCircle2 size={18} />}
              title="Complétion"
              description="Jusqu’à 15 points selon le taux de missions terminées."
            />
            <ScoreRule
              icon={<Ban size={18} />}
              title="Fiabilité"
              description="Jusqu’à 10 points selon le taux d’annulation."
            />
            <ScoreRule
              icon={<Star size={18} />}
              title="Avis vérifiés"
              description="Jusqu’à 15 points, avec un poids progressif jusqu’à 5 avis."
            />
          </div>

          {result && (
            <div className="mt-7 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-black text-emerald-700 dark:text-emerald-300">
                    {result.message}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.updated ?? 0} service(s)
                    mis à jour.
                  </p>
                </div>

                {typeof result.klyxScore ===
                  "number" && (
                  <div className="rounded-xl bg-background px-4 py-3 text-center dark:bg-zinc-950">
                    <p className="text-3xl font-black text-violet-700 dark:text-violet-300">
                      {result.klyxScore.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      /100
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric
                  label="Terminées"
                  value={result.completedJobs ?? 0}
                />
                <Metric
                  label="Annulées"
                  value={result.cancelledJobs ?? 0}
                />
                <Metric
                  label="Avis"
                  value={result.reviewCount ?? 0}
                />
                <Metric
                  label="Note"
                  value={
                    result.reviewCount
                      ? `${(
                          result.averageRating ?? 0
                        ).toFixed(1)}/5`
                      : "—"
                  }
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={recalculateScores}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-base font-black text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <RefreshCw
              size={20}
              className={
                loading ? "animate-spin" : ""
              }
            />

            {loading
              ? "Calcul en cours..."
              : "Actualiser mon KLYX Score"}
          </button>
        </section>
      </div>
    </main>
  );
}

function ScoreRule({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
      <div className="flex items-center gap-2 font-black">
        <span className="text-violet-600 dark:text-violet-400">
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3 text-center dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-lg font-black">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
