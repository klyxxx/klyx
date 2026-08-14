"use client";

import Link from "next/link";

import {
  Ban,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  useState,
  type ReactNode,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_GROUP_AWARE_SCORE_UI_13_01

type ScoreResponse = {
  updated?: number;

  completedJobs?: number;
  cancelledJobs?: number;
  totalJobs?: number;

  completedSlots?: number;
  cancelledSlots?: number;
  totalSlots?: number;

  singleMissionCount?: number;
  groupedMissionCount?: number;

  cancellationRate?: number;

  averageRating?: number;
  reviewCount?: number;

  klyxScore?: number;

  groupAware?: boolean;

  message?: string;
  error?: string;
};

function percentage(
  value:
    | number
    | undefined
) {
  if (
    typeof value !==
    "number"
  ) {
    return "0%";
  }

  return (
    value.toFixed(
      1
    ) +
    "%"
  );
}

export default function ScoresPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    result,
    setResult,
  ] =
    useState<
      ScoreResponse |
      null
    >(
      null
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  async function recalculateScores() {
    setLoading(
      true
    );

    setResult(
      null
    );

    setErrorMessage(
      ""
    );

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (
        !session?.access_token
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      const response =
        await fetch(
          "/api/scores/recalculate",
          {
            method:
              "POST",

            headers: {
              Authorization:
                "Bearer " +
                session.access_token,
            },
          }
        );

      const body =
        (await response.json()) as
          ScoreResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          body.error ||
          "Recalcul impossible."
        );
      }

      setResult(
        body
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground dark:bg-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          Retour au tableau de bord
        </Link>

        <section className="mt-7 rounded-[2rem] border border-border bg-card p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ShieldCheck
              size={28}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              KLYX Score v3
            </p>

            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
              Group-aware
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            Ta fiabilité professionnelle
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            KLYX distingue maintenant les missions commerciales
            du volume réel de créneaux exécutés. Une mission
            groupée reste une seule mission pour ton score,
            même si elle contient plusieurs interventions.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <ScoreRule
              icon={
                <BriefcaseBusiness
                  size={18}
                />
              }
              title="Activité"
              description="Jusqu’à 20 points selon le nombre de missions commerciales terminées."
            />

            <ScoreRule
              icon={
                <CheckCircle2
                  size={18}
                />
              }
              title="Complétion"
              description="Une mission groupée compte une seule fois dans le taux de complétion."
            />

            <ScoreRule
              icon={
                <Ban
                  size={18}
                />
              }
              title="Fiabilité"
              description="Une annulation groupée compte comme une annulation, pas une annulation par créneau."
            />

            <ScoreRule
              icon={
                <Star
                  size={18}
                />
              }
              title="Avis vérifiés"
              description="Une mission groupée produit un seul signal qualité vérifié."
            />
          </div>

          <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
            <div className="flex items-start gap-3">
              <Layers3
                className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                size={20}
              />

              <div>
                <p className="font-black">
                  Exemple multi-créneaux
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Une mission lundi, mardi et mercredi =
                  <strong className="text-foreground">
                    {" "}
                    1 mission commerciale
                  </strong>
                  {" "}et
                  <strong className="text-foreground">
                    {" "}
                    3 créneaux exécutés
                  </strong>
                  .
                </p>
              </div>
            </div>
          </div>

          {result && (
            <section className="mt-7">
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-emerald-700 dark:text-emerald-300">
                      {
                        result.message
                      }
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {
                        result.updated ??
                        0
                      }
                      {" service(s) mis à jour."}
                    </p>

                    {result.groupAware && (
                      <p className="mt-2 inline-flex rounded-full bg-background/70 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-zinc-950/60 dark:text-emerald-300">
                        Calcul commercial group-aware actif
                      </p>
                    )}
                  </div>

                  {typeof result.klyxScore ===
                    "number" && (
                    <div className="rounded-2xl bg-background px-5 py-4 text-center dark:bg-zinc-950">
                      <p className="text-4xl font-black text-violet-700 dark:text-violet-300">
                        {result.klyxScore.toFixed(
                          0
                        )}
                      </p>

                      <p className="text-xs font-bold text-muted-foreground">
                        KLYX Score /100
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* KLYX_COMMERCIAL_MISSION_METRICS_13_01 */}
              <section className="mt-6">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness
                    size={20}
                    className="text-violet-600"
                  />

                  <h2 className="text-xl font-black">
                    Missions commerciales
                  </h2>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  C’est cette métrique qui influence la partie
                  activité, complétion et annulation du KLYX Score.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric
                    label="Terminées"
                    value={
                      result.completedJobs ??
                      0
                    }
                  />

                  <Metric
                    label="Annulées"
                    value={
                      result.cancelledJobs ??
                      0
                    }
                  />

                  <Metric
                    label="Total missions"
                    value={
                      result.totalJobs ??
                      0
                    }
                  />

                  <Metric
                    label="Taux annulation"
                    value={percentage(
                      result.cancellationRate
                    )}
                  />
                </div>
              </section>

              {/* KLYX_EXECUTION_SLOT_METRICS_13_01 */}
              <section className="mt-7 rounded-3xl border border-border bg-background/55 p-5 dark:border-zinc-700 dark:bg-zinc-950/40 sm:p-6">
                <div className="flex items-center gap-2">
                  <CalendarDays
                    size={20}
                    className="text-blue-600"
                  />

                  <h2 className="text-xl font-black">
                    Volume d’exécution
                  </h2>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Ces chiffres mesurent ton volume réel de
                  prestations sans gonfler artificiellement ton
                  nombre de missions.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric
                    label="Créneaux terminés"
                    value={
                      result.completedSlots ??
                      0
                    }
                  />

                  <Metric
                    label="Créneaux annulés"
                    value={
                      result.cancelledSlots ??
                      0
                    }
                  />

                  <Metric
                    label="Total créneaux"
                    value={
                      result.totalSlots ??
                      0
                    }
                  />

                  <Metric
                    label="Missions groupées"
                    value={
                      result.groupedMissionCount ??
                      0
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Missions simples"
                    value={
                      result.singleMissionCount ??
                      0
                    }
                  />

                  <Metric
                    label="Missions multi-créneaux"
                    value={
                      result.groupedMissionCount ??
                      0
                    }
                  />
                </div>
              </section>

              <section className="mt-7">
                <div className="flex items-center gap-2">
                  <Star
                    size={20}
                    className="text-amber-500"
                  />

                  <h2 className="text-xl font-black">
                    Qualité
                  </h2>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
                  <Metric
                    label="Avis vérifiés"
                    value={
                      result.reviewCount ??
                      0
                    }
                  />

                  <Metric
                    label="Note moyenne"
                    value={
                      result.reviewCount
                        ? (
                            result.averageRating ??
                            0
                          ).toFixed(
                            1
                          ) +
                          "/5"
                        : "—"
                    }
                  />
                </div>
              </section>
            </section>
          )}

          {errorMessage && (
            <div className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
              {
                errorMessage
              }
            </div>
          )}

          <button
            type="button"
            onClick={
              recalculateScores
            }
            disabled={
              loading
            }
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-4 text-base font-black text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            <RefreshCw
              size={20}
              className={
                loading
                  ? "animate-spin"
                  : ""
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
  icon: ReactNode;
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
    <div className="rounded-xl border border-border bg-background/70 p-4 text-center dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-2xl font-black">
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}